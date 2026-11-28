import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { addPlayer, iso, sqliteD1 } from "@/lib/__tests__/d1-sqlite";
import { mergeGuest } from "@/lib/account/guest-merge";
import { readMonkMine, readMonkTop } from "@/server/utils/leaderboard";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { LOCALES } from "@/lib/i18n/locales";
import { dedupeBests, isAcceptable, overlay, parseAccountRecords, parseSyncBody, type BestEntry } from "../account-records";
import { SCOPES, isScope, parseMine, parseTop, periodOf } from "../leaderboard";
import { localBest } from "../leaderboard-client";
import { gameMetadata, sharedBanner, sharedMetadata } from "../meta";
import { applyRun, emptyRecords, loadRecords, mergeRecords, parseRecords, saveRun, SUMMIT_FLOOR, type Store } from "../records";
import { scoreOf } from "../scoring";
import { shareable } from "../config";
import { decodeRun, encodeRun } from "../share-code";
import { AUDIO_READY, SOUND_FILES, sloshGain, soundFor, tickTimes } from "../sound-mix";
import { addToInbox, loadPending, parsePending, prune, readInbox, removeConfirmed, removeInbox, resetPending, runEntries, savePending, withBests } from "../sync-state";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 28, 4);
const memory = (): Store & { data: Map<string, string>; removeItem(key: string): void; key(i: number): string | null; length: number } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
    key: (i) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
  };
};
const run = (mode: "fixed" | "random", score: number | null, timeMs = 50_000, floor = SUMMIT_FLOOR) => ({
  mode,
  floor,
  best: score === null ? null : { score, timeMs },
});

describe("J1 J2 本機紀錄", () => {
  it("J1 兩種模式各自比較；分數高的較好，同分時間短的較好；完全平手不算新紀錄", () => {
    const first = applyRun(emptyRecords(), run("fixed", 700));
    expect(first).toMatchObject({ newBest: true, newFloor: true });
    expect(first.records.fixed).toEqual({ score: 700, timeMs: 50_000 });
    expect(first.records.random).toBeNull();
    expect(applyRun(first.records, run("fixed", 700)).newBest).toBe(false);
    expect(applyRun(first.records, run("fixed", 700, 49_000)).newBest).toBe(true);
    expect(applyRun(first.records, run("fixed", 699, 10_000)).newBest).toBe(false);
    expect(applyRun(first.records, run("random", 100)).newBest).toBe(true);
  });
  it("J1 失敗只更新最高到達層數，不動分數；送達塔頂記為塔頂", () => {
    const fell = applyRun(emptyRecords(), run("random", null, 0, 3));
    expect(fell).toMatchObject({ newBest: false, newFloor: true });
    expect(fell.records.floors.random).toBe(3);
    expect(fell.records.random).toBeNull();
    expect(applyRun(fell.records, run("random", null, 0, 2)).newFloor).toBe(false);
    expect(applyRun(fell.records, run("random", 500)).records.floors.random).toBe(SUMMIT_FLOOR);
  });
  it("存進 localStorage、讀得回來；壞資料當作空的；和帳號紀錄合併各取最佳、層數留本機", () => {
    const store = memory();
    saveRun(run("fixed", 810, 40_000), store);
    expect(loadRecords(store).fixed).toEqual({ score: 810, timeMs: 40_000 });
    expect(parseRecords("{bad")).toEqual(emptyRecords());
    expect(parseRecords(JSON.stringify({ fixed: { score: 2000, timeMs: 1 } })).fixed).toBeNull();
    const local = { ...emptyRecords(), fixed: { score: 800, timeMs: 30_000 }, floors: { fixed: 6, random: 2 } };
    const merged = mergeRecords({ fixed: { score: 800, timeMs: 35_000 }, random: { score: 400, timeMs: 1 } }, local);
    expect(merged).toEqual({ fixed: { score: 800, timeMs: 30_000 }, random: { score: 400, timeMs: 1 }, floors: { fixed: 6, random: 2 } });
  });
  it("J2 不能儲存時照常能算（saved: false）", () => {
    const broken: Store = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
    const outcome = saveRun(run("fixed", 600), broken);
    expect(outcome.saved).toBe(false);
    expect(outcome.newBest).toBe(true);
    expect(saveRun(run("fixed", 600), null).saved).toBe(false);
  });
});

describe("P4 P5 帳號紀錄的檢查", () => {
  const entry = (over: Partial<BestEntry> = {}): BestEntry => ({ mode: "fixed", score: 800, timeMs: 40_000, achievedAt: NOW, ...over });
  const body = (bests: unknown[]) => ({ syncId: "abcdefgh12", playerId: "p1", bests });
  it("P5 格式或範圍不對整批拒絕：mode 只能 fixed、random；分數 0～1000 整數；時間 1 秒～30 分鐘", () => {
    expect(parseSyncBody(body([entry()]), NOW)?.bests).toHaveLength(1);
    for (const bad of [{ mode: "daily" }, { score: 1001 }, { score: 1.5 }, { timeMs: 999 }, { timeMs: 30 * 60_000 + 1 }, { extra: 1 }]) {
      expect(parseSyncBody(body([entry(), { ...entry(), ...bad }]), NOW), JSON.stringify(bad)).toBeNull();
    }
    expect(parseSyncBody(body([entry({ timeMs: 1000 }), entry({ timeMs: 30 * 60_000 })]), NOW)).not.toBeNull();
  });
  it("P5 創下時間比現在晚超過 1 天只略過那一筆", () => {
    expect(parseSyncBody(body([entry(), entry({ mode: "random", achievedAt: NOW + 2 * DAY })]), NOW)?.bests).toEqual([entry()]);
    expect(isAcceptable(entry({ achievedAt: NOW + DAY - 1 }), NOW)).toBe(true);
  });
  it("P4 每種模式取最佳：分數高、同分時間短、再同先創下的；疊到帳號紀錄上", () => {
    const list = [entry({ score: 700 }), entry({ score: 800, timeMs: 45_000 }), entry({ score: 800, timeMs: 40_000, achievedAt: NOW + 5 }), entry({ score: 800, timeMs: 40_000, achievedAt: NOW })];
    expect(dedupeBests(list)).toEqual([entry({ score: 800, timeMs: 40_000, achievedAt: NOW })]);
    expect(overlay({ fixed: { score: 800, timeMs: 42_000 }, random: null }, [entry()])).toEqual({ fixed: { score: 800, timeMs: 40_000 }, random: null });
    expect(overlay({ fixed: { score: 900, timeMs: 99_000 }, random: null }, [entry()]).fixed).toEqual({ score: 900, timeMs: 99_000 });
    expect(parseAccountRecords({ fixed: { score: 1, timeMs: 2 }, random: null })).toEqual({ fixed: { score: 1, timeMs: 2 }, random: null });
    expect(parseAccountRecords({ score: 1 })).toBeNull();
  });
});

describe("P8 待上傳的狀態（冪等的取最佳）", () => {
  it("送達塔頂產生一筆候選；inbox 收進 pending 後刪掉來源", () => {
    const store = memory();
    addToInbox(store, runEntries({ mode: "fixed", score: 800, timeMs: 40_000 }, NOW), "run1");
    addToInbox(store, runEntries({ mode: "fixed", score: 820, timeMs: 50_000 }, NOW + 1), "run2");
    const inbox = readInbox(store);
    expect(inbox.batch).toEqual([{ mode: "fixed", score: 820, timeMs: 50_000, achievedAt: NOW + 1 }]);
    const state = withBests(loadPending(store, () => "guestsync01"), inbox.batch);
    expect(savePending(store, state)).toBe(true);
    removeInbox(store, inbox.keys);
    expect(readInbox(store).keys).toHaveLength(0);
    expect(parsePending(store.getItem("game-station:monk-soup-tower:pending:v1"))?.bests).toHaveLength(1);
    resetPending(store);
  });
  it("送出成功只移除不比送出那筆好的（送出期間新增的更好的留著）", () => {
    const sent = [{ mode: "fixed" as const, score: 800, timeMs: 40_000, achievedAt: NOW }];
    const state = { guestSyncId: "guestsync01", bests: [{ mode: "fixed" as const, score: 800, timeMs: 39_000, achievedAt: NOW + 1 }, { mode: "random" as const, score: 10, timeMs: 9000, achievedAt: NOW }] };
    expect(removeConfirmed(state, sent).bests.map((e) => e.mode)).toEqual(["fixed", "random"]);
    expect(removeConfirmed({ ...state, bests: sent }, sent).bests).toEqual([]);
    expect(prune({ guestSyncId: "guestsync01", bests: [{ ...sent[0]!, achievedAt: NOW + 3 * DAY }] }, NOW).bests).toEqual([]);
    expect(parsePending('{"guestSyncId":"x","bests":[]}')).toBeNull();
  });
});

describe("J3 成績代碼", () => {
  it("編碼後解碼；得分由湯量與時間算出；隨機模式帶塔號", () => {
    const shared = { mode: "random" as const, seed: 4321, soup: 960, timeMs: 40_000, score: scoreOf(960, 40_000), newRecord: true };
    const decoded = decodeRun(encodeRun(shared))!;
    expect(decoded).toMatchObject({ ...shared, score: 845, grade: "S", temp: 68, band: "veryWarm" });
    const fixed = decodeRun(encodeRun({ mode: "fixed", seed: null, soup: 1000, timeMs: 30_000, score: scoreOf(1000, 30_000), newRecord: false }))!;
    expect(fixed.seed).toBeNull();
  });
  it("J3 P5 能上傳、能分享的時間範圍和伺服器一致：1 秒～30 分鐘（超過的照常結算，但不送、不分享）", () => {
    expect([shareable(999), shareable(1000), shareable(30 * 60_000), shareable(30 * 60_000 + 1)]).toEqual([false, true, true, false]);
    const tooLong = { mode: "fixed" as const, seed: null, soup: 500, timeMs: 30 * 60_000 + 1, score: scoreOf(500, 30 * 60_000 + 1), newRecord: false };
    expect(decodeRun(encodeRun(tooLong))).toBeNull();
    expect(parseSyncBody({ syncId: "abcdefgh12", playerId: "p", bests: [{ mode: "fixed", score: 250, timeMs: 30 * 60_000 + 1, achievedAt: NOW }] }, NOW)).toBeNull();
  });

  it("分數對不上、被改過、格式不對都回傳 null，不丟錯誤", () => {
    const good = encodeRun({ mode: "fixed", seed: null, soup: 900, timeMs: 50_000, score: 765, newRecord: false });
    expect(decodeRun(good)?.score).toBe(765);
    expect(decodeRun(encodeRun({ mode: "fixed", seed: null, soup: 900, timeMs: 50_000, score: 999, newRecord: false }))).toBeNull();
    expect(decodeRun(encodeRun({ mode: "random", seed: 0, soup: 900, timeMs: 50_000, score: 765, newRecord: false }))).toBeNull();
    expect(decodeRun(encodeRun({ mode: "fixed", seed: null, soup: 900, timeMs: 10, score: scoreOf(900, 10), newRecord: false }))).toBeNull();
    expect(decodeRun(`${good.slice(0, -2)}AA`)).toBeNull();
    expect(decodeRun("not-a-code")).toBeNull();
    expect(decodeRun("")).toBeNull();
  });
});

describe("M 音效混音", () => {
  it("M2 事件對應音效；湯晃聲隨 |θ| 變大；跑分音 1.2 秒內播完", () => {
    expect(new Set(SOUND_FILES).size).toBe(SOUND_FILES.length);
    expect(SOUND_FILES).toHaveLength(13);
    expect(soundFor({ type: "step", slip: false, x: 0, z: 0 })).toBe("step-wood.mp3");
    expect(soundFor({ type: "step", slip: true, x: 0, z: 0 })).toBe("step-slip.mp3");
    expect(soundFor({ type: "spill", x: 0, z: 0, dx: 1, dz: 0 })).toBe("spill.mp3");
    expect(soundFor({ type: "fall", x: 0, z: 0 })).toBe("fall.mp3");
    expect(soundFor({ type: "cold" })).toBe("soup-cold.mp3");
    expect(soundFor({ type: "summit" })).toBe("summit-bell.mp3");
    expect(soundFor({ type: "floor", floor: 2 })).toBe("floor-clear.mp3");
    expect(soundFor({ type: "floor", floor: 1 })).toBeNull();
    expect(sloshGain(0)).toBe(0);
    expect(sloshGain(0.4)).toBe(1);
    expect(sloshGain(0.2)).toBeGreaterThan(sloshGain(0.1));
    expect(Math.max(...tickTimes())).toBeLessThan(1.2);
    // 還沒交檔：不送請求
    expect(typeof AUDIO_READY).toBe("boolean");
  });
});

describe("T 排行榜（SQL）", () => {
  let d1: D1Database;
  let raw: ReturnType<typeof sqliteD1>["raw"];
  const best = (id: string, mode: "fixed" | "random", score: number, timeMs: number, at: number) =>
    raw.prepare("INSERT INTO monk_soup_tower_bests (player_id, mode, score, time_ms, achieved_at) VALUES (?, ?, ?, ?, ?)").run(id, mode, score, timeMs, iso(at));
  beforeEach(() => {
    ({ d1, raw } = sqliteD1());
    for (const id of ["a", "b", "c", "d", "g"]) addPlayer(raw, id, id === "g" ? "guest" : "google");
  });

  it("T1 T2 一張固定關卡榜：分數高的在前、同分時間短的在前、再同先創下的在前；隨機模式不上榜；不帶玩家 ID", async () => {
    best("a", "fixed", 800, 50_000, NOW);
    best("b", "fixed", 800, 45_000, NOW);
    best("c", "fixed", 800, 45_000, NOW - 1000);
    best("d", "fixed", 900, 90_000, NOW);
    best("g", "fixed", 100, 10_000, NOW);
    best("a", "random", 999, 10_000, NOW);
    const top = await readMonkTop(d1, "fixed", NOW);
    expect(top.rows.map((r) => [r.rank, r.score, r.timeMs])).toEqual([
      [1, 900, 90_000],
      [2, 800, 45_000],
      [3, 800, 45_000],
      [4, 800, 50_000],
      [5, 100, 10_000],
    ]);
    expect(top.rows[4]!.guest).toBe(true);
    expect(top.total).toBe(5);
    expect(JSON.stringify(top)).not.toMatch(/"a"|player/);
    expect(parseTop(top)?.rows).toHaveLength(5);
    expect(SCOPES).toEqual(["fixed"]);
    expect(isScope("random")).toBe(false);
    expect(periodOf("fixed", NOW)).toBe("");
  });

  it("T5 自己的名次：前 100 名內、同分比時間；沒有成績時是 null", async () => {
    best("a", "fixed", 800, 50_000, NOW);
    best("b", "fixed", 800, 40_000, NOW);
    expect(await readMonkMine(d1, "fixed", "a", NOW)).toEqual({ rank: 2, score: 800, timeMs: 50_000, total: 2, toTop100: null });
    expect(await readMonkMine(d1, "fixed", "c", NOW)).toEqual({ rank: null, score: null, timeMs: null, total: 2, toTop100: null });
    expect(parseMine(await readMonkMine(d1, "fixed", "a", NOW))).toBeTruthy();
    expect(localBest({ ...emptyRecords(), fixed: { score: 7, timeMs: 9000 } }, "fixed")).toEqual({ score: 7, timeMs: 9000 });
  });

  it("T5 100 名外：再 N 分進前 100 名", async () => {
    for (let i = 0; i < 101; i++) {
      addPlayer(raw, `p${i}`, "google");
      best(`p${i}`, "fixed", 500 + i, 60_000, NOW);
    }
    best("a", "fixed", 400, 60_000, NOW);
    const mine = await readMonkMine(d1, "fixed", "a", NOW);
    expect(mine.rank).toBe(102);
    // 第 100 名是 501 分：要比它多 1 分
    expect(mine.toTop100).toBe(501 - 400 + 1);
  });

  it("P7 訪客併進帳號：各取最佳（同分比時間、再同先創下的）、同一個 batch，訪客刪掉", async () => {
    best("a", "fixed", 800, 50_000, NOW);
    best("g", "fixed", 800, 45_000, NOW + 5);
    best("a", "random", 600, 30_000, NOW);
    best("g", "random", 500, 1000, NOW);
    await mergeGuest(d1, "g", "a");
    const rows = raw.prepare("SELECT mode, score, time_ms, achieved_at FROM monk_soup_tower_bests WHERE player_id = 'a' ORDER BY mode").all();
    expect(rows).toEqual([
      { mode: "fixed", score: 800, time_ms: 45_000, achieved_at: iso(NOW + 5) },
      { mode: "random", score: 600, time_ms: 30_000, achieved_at: iso(NOW) },
    ]);
    expect(raw.prepare("SELECT COUNT(*) AS n FROM players WHERE id = 'g'").get()).toEqual({ n: 0 });
    expect(raw.prepare("SELECT COUNT(*) AS n FROM monk_soup_tower_bests WHERE player_id = 'g'").get()).toEqual({ n: 0 });
    const source = readFileSync(join(process.cwd(), "lib/account/guest-merge.ts"), "utf8");
    expect(source).toMatch(/d1\.batch\(\[[\s\S]*monk_soup_tower_bests[\s\S]*DELETE FROM players/);
  });

  it("P10 刪除玩家時最佳紀錄一起刪（ON DELETE CASCADE）", () => {
    best("a", "fixed", 1, 9000, NOW);
    raw.prepare("DELETE FROM players WHERE id = 'a'").run();
    expect(raw.prepare("SELECT COUNT(*) AS n FROM monk_soup_tower_bests").get()).toEqual({ n: 0 });
  });

  it("L3 migration 0008 只建一張表：欄位、主鍵、索引、外鍵 ON DELETE CASCADE", () => {
    const sql = readFileSync(join(process.cwd(), "migrations/0008_add_monk_soup_tower_bests.sql"), "utf8");
    expect(sql.match(/CREATE TABLE/g)).toHaveLength(1);
    expect(sql).not.toMatch(/ALTER|DROP/);
    const columns = (raw.prepare("PRAGMA table_info(monk_soup_tower_bests)").all() as { name: string }[]).map((c) => c.name);
    expect(columns).toEqual(["player_id", "mode", "score", "time_ms", "achieved_at"]);
    expect(sql).toContain('PRIMARY KEY ("player_id", "mode")');
    expect(sql).toContain('ON DELETE CASCADE');
    expect(sql).toContain('("mode", "score" DESC, "time_ms")');
  });
});

describe("K SEO 與文字", () => {
  it("K3 每種語言的頁面標題、描述、canonical；成績連結 noindex、預覽圖是成績圖", () => {
    for (const locale of LOCALES) {
      const meta = gameMetadata(locale, "monk-soup-tower");
      expect(meta.title).toBe(dictionaries[locale].monkSoupTower.title);
      expect(meta.description).toBe(dictionaries[locale].monkSoupTower.metaDescription);
      expect(meta.canonical).toContain("/games/monk-soup-tower");
    }
    const code = encodeRun({ mode: "fixed", seed: null, soup: 960, timeMs: 40_000, score: 845, newRecord: false });
    const shared = sharedMetadata("en", "monk-soup-tower", code);
    expect(shared.noindex).toBe(true);
    expect(JSON.stringify(shared.openGraph)).toContain(`/en/games/monk-soup-tower/r/${code}/card`);
    expect(sharedBanner("en", code)).toContain("845");
    expect(sharedBanner("en", "bad")).toBeNull();
  });
  it("K4 遊戲名七種語言用設計稿第 11 節的版本", () => {
    expect(LOCALES.map((locale) => dictionaries[locale].monkSoupTower.title)).toEqual([
      "和尚端湯上塔",
      "和尚端汤上塔",
      "Monk, Soup, Pagoda",
      "お坊さんのスープ塔のぼり",
      "스님의 국 배달 탑 오르기",
      "Sư Bưng Canh Lên Tháp",
      "Monge, Sopa e Pagode",
    ]);
  });
  it("K7 層數牌：中文用國字，其他語言用阿拉伯數字", () => {
    expect(dictionaries["zh-TW"].monkSoupTower.floorNames[2]).toBe("第三層");
    expect(dictionaries["zh-CN"].monkSoupTower.floorNames[2]).toBe("第三层");
    for (const locale of ["en", "ja", "ko", "vi", "pt"] as const) {
      const names = dictionaries[locale].monkSoupTower.floorNames;
      expect(names, locale).toHaveLength(5);
      names.forEach((name, i) => expect(name, locale).toContain(String(i + 1)));
    }
  });
});
