import { beforeEach, describe, expect, it } from "vitest";
import { addPlayer, iso, sqliteD1 } from "@/lib/__tests__/d1-sqlite";
import { mergeGuest } from "@/lib/account/guest-merge";
import { readMineMine, readMineTop } from "@/server/utils/leaderboard";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { LOCALES } from "@/lib/i18n/locales";
import { MAX_DEPTH, MAX_SCORE } from "../config";
import { dedupeBests, isAcceptable, overlay, parseAccountRecords, parseSyncBody, type BestEntry } from "../account-records";
import { SCOPES, isScope, parseMine, parseTop, periodOf } from "../leaderboard";
import { localBest } from "../leaderboard-client";
import { gameMetadata, sharedBanner, sharedMetadata } from "../meta";
import { applyRun, emptyRecords, mergeRecords, parseRecords, saveRun, type Store } from "../records";
import { decodeRun, encodeRun, toSharedRun } from "../share-code";
import { SOUND_FILES, grazeRate, landGain, rumbleGain, soundFor, tickTimes, whooshGain } from "../sound-mix";
import { PENDING_KEY, addToInbox, loadPending, parsePending, prune, readInbox, removeConfirmed, removeInbox, resetPending, runEntries, savePending, withBests } from "../sync-state";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 23, 4);
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

describe("J1 J2 本機紀錄", () => {
  it("最高分和最深深度各自比較；破紀錄才覆寫；第一局兩個都算新紀錄", () => {
    const first = applyRun(emptyRecords(), { depth: 100, total: 3000 });
    expect(first).toMatchObject({ newScore: true, newDepth: true });
    expect(first.records).toEqual({ score: 3000, depth: 100 });
    // 深度比較深、分數比較低：只破深度紀錄
    const second = applyRun(first.records, { depth: 150, total: 2000 });
    expect(second).toMatchObject({ newScore: false, newDepth: true });
    expect(second.records).toEqual({ score: 3000, depth: 150 });
    // 平手不算新紀錄
    expect(applyRun(second.records, { depth: 150, total: 3000 })).toMatchObject({ newScore: false, newDepth: false });
  });
  it("存進 localStorage、讀得回來；壞資料當作空的；合併各取高值", () => {
    const store = memory();
    expect(saveRun({ depth: 12, total: 100 }, store)).toMatchObject({ saved: true });
    expect(parseRecords(store.getItem("game-station:mine-descent:v1"))).toEqual({ score: 100, depth: 12 });
    expect(parseRecords("{壞掉")).toEqual(emptyRecords());
    expect(parseRecords(JSON.stringify({ score: -1, depth: 1.5 }))).toEqual(emptyRecords());
    expect(mergeRecords({ score: 5, depth: null }, { score: 9, depth: 3 })).toEqual({ score: 9, depth: 3 });
  });
  it("J2 不能儲存時照常能算（saved: false）", () => {
    const broken = { getItem: () => null, setItem: () => { throw new Error("quota"); } } as Store;
    expect(saveRun({ depth: 1, total: 10 }, broken)).toMatchObject({ saved: false, newScore: true });
    expect(saveRun({ depth: 1, total: 10 }, null)).toMatchObject({ saved: false });
  });
});

describe("J2b 儲存失敗時以記憶體為準（Codex 審查第 6 項）", () => {
  const broken = { getItem: () => null, setItem: () => { throw new Error("quota"); } } as Store;
  it("上一局的新紀錄還在記憶體，下一局較低的成績不會讓最佳倒退", () => {
    const first = saveRun({ depth: 50, total: 500 }, broken, emptyRecords());
    expect(first.records).toEqual({ score: 500, depth: 50 });
    const second = saveRun({ depth: 20, total: 200 }, broken, first.records);
    expect(second.records).toEqual({ score: 500, depth: 50 });
    expect(second).toMatchObject({ newScore: false, newDepth: false, saved: false });
  });
  it("寫不進瀏覽器的 inbox 先放在記憶體：同步看得到、收走只移除收的那幾筆、登出清空", () => {
    addToInbox(broken as never, runEntries({ depth: 50, total: 500 }, NOW), "a");
    const taken = readInbox(broken as never);
    expect(taken.batch.map((b) => `${b.mode}:${b.score}`).sort()).toEqual(["depth:50", "score:500"]);
    // 收的期間又玩完一局（也寫不進去）：只移除剛才收的，新的留著
    addToInbox(broken as never, runEntries({ depth: 90, total: 900 }, NOW + 1), "b");
    removeInbox(broken as never, taken.keys);
    expect(readInbox(broken as never).batch.map((b) => `${b.mode}:${b.score}`).sort()).toEqual(["depth:90", "score:900"]);
    resetPending(null);
    expect(readInbox(broken as never).batch).toEqual([]);
  });
});

describe("P4 帳號紀錄的檢查", () => {
  const ok = (over: object = {}) => ({ syncId: "abcdefgh1234", playerId: "p1", bests: [{ mode: "score", score: 100, achievedAt: NOW }], ...over });
  it("格式或數值範圍不對整批拒絕", () => {
    expect(parseSyncBody(ok(), NOW)?.bests).toHaveLength(1);
    expect(parseSyncBody(ok({ bests: [{ mode: "score", score: MAX_SCORE + 1, achievedAt: NOW }] }), NOW)).toBeNull();
    expect(parseSyncBody(ok({ bests: [{ mode: "depth", score: MAX_DEPTH + 1, achievedAt: NOW }] }), NOW)).toBeNull();
    expect(parseSyncBody(ok({ bests: [{ mode: "daily", score: 1, achievedAt: NOW }] }), NOW)).toBeNull();
    expect(parseSyncBody(ok({ bests: [{ mode: "score", dateKey: null, score: 1, achievedAt: NOW }] }), NOW)).toBeNull();
    expect(parseSyncBody(ok({ bests: Array.from({ length: 5 }, () => ({ mode: "score", score: 1, achievedAt: NOW })) }), NOW)).toBeNull();
    expect(parseSyncBody(ok({ syncId: "x" }), NOW)).toBeNull();
    expect(parseSyncBody(ok({ extra: 1 }), NOW)).toBeNull();
  });
  it("時間不對（比現在晚超過 1 天）只略過那一筆，不讓整批被拒", () => {
    const body = parseSyncBody(ok({ bests: [{ mode: "score", score: 1, achievedAt: NOW + 3 * DAY }, { mode: "depth", score: 9, achievedAt: NOW }] }), NOW);
    expect(body?.bests).toEqual([{ mode: "depth", score: 9, achievedAt: NOW }]);
    expect(isAcceptable({ mode: "score", score: 1, achievedAt: NOW + DAY / 2 }, NOW)).toBe(true);
  });
  it("同一種只留高值，同值留先創下的；疊到帳號紀錄上各取高值", () => {
    const entries: BestEntry[] = [
      { mode: "score", score: 10, achievedAt: 5 },
      { mode: "score", score: 10, achievedAt: 3 },
      { mode: "score", score: 8, achievedAt: 1 },
      { mode: "depth", score: 4, achievedAt: 9 },
    ];
    expect(dedupeBests(entries)).toEqual([entries[1], entries[3]]);
    expect(overlay({ score: 5, depth: 9 }, entries)).toEqual({ score: 10, depth: 9 });
    expect(parseAccountRecords({ score: 1, depth: null })).toEqual({ score: 1, depth: null });
    expect(parseAccountRecords({ score: "x", depth: null })).toBeNull();
  });
});

describe("P 待上傳的狀態（冪等的取高值，不需要批次代碼）", () => {
  it("一局產生分數與深度兩筆候選；inbox 收進 pending 後刪掉來源", () => {
    const store = memory();
    addToInbox(store, runEntries({ depth: 50, total: 500 }, NOW), "a");
    addToInbox(store, runEntries({ depth: 90, total: 900 }, NOW + 1), "b");
    const inbox = readInbox(store);
    expect(inbox.keys).toHaveLength(2);
    const state = withBests(loadPending(store, () => "guest-sync-0001"), inbox.batch);
    expect(state.bests.map((b) => `${b.mode}:${b.score}`).sort()).toEqual(["depth:90", "score:900"]);
    expect(savePending(store, state)).toBe(true);
    removeInbox(store, inbox.keys);
    expect(readInbox(store).keys).toEqual([]);
    expect(parsePending(store.getItem(PENDING_KEY))).toEqual(state);
  });
  it("送出成功只移除數值不高於送出那筆的（送出期間新增的更高值留著）", () => {
    const sent = runEntries({ depth: 50, total: 500 }, NOW);
    const state = withBests({ guestSyncId: "guest-sync-0001", bests: sent }, runEntries({ depth: 70, total: 400 }, NOW + 5));
    expect(removeConfirmed(state, sent).bests).toEqual([{ mode: "depth", score: 70, achievedAt: NOW + 5 }]);
    expect(removeConfirmed({ guestSyncId: "guest-sync-0001", bests: sent }, sent).bests).toEqual([]);
  });
  it("時間不合理的濾掉；壞資料與不合格的 guestSyncId 當作沒有；不能儲存時記在記憶體", () => {
    const future = runEntries({ depth: 5, total: 5 }, NOW + 9 * DAY);
    expect(prune({ guestSyncId: "guest-sync-0001", bests: future }, NOW).bests).toEqual([]);
    expect(parsePending("{}")).toBeNull();
    expect(parsePending(JSON.stringify({ guestSyncId: "短", bests: [] }))).toBeNull();
    expect(savePending(null, { guestSyncId: "guest-sync-0002", bests: [] })).toBe(false);
    expect(loadPending(null, () => "unused-id-1234").guestSyncId).toBe("guest-sync-0002");
    savePending(memory(), { guestSyncId: "guest-sync-0003", bests: [] });
  });
});

describe("J4 J7 成績代碼", () => {
  const run = { depth: 128, newScore: true, newDepth: false, parts: { depth: 1500, graze: 200, crystal: 60 } };
  it("編碼後解碼，總分由三項加總", () => {
    const decoded = decodeRun(encodeRun(toSharedRun(run)))!;
    expect(decoded).toMatchObject({ depth: 128, newScore: true, newDepth: false, total: 1760 });
  });
  it("被改過、格式不對、深度分對不上深度都回傳 null，不丟錯誤", () => {
    const code = encodeRun(toSharedRun(run));
    expect(decodeRun(code.slice(0, -2) + "AA")).toBeNull();
    expect(decodeRun("")).toBeNull();
    expect(decodeRun("%%%")).toBeNull();
    expect(decodeRun("x".repeat(100))).toBeNull();
    // 128 公尺的深度分一定在 1,280（無倍率）到 2,560（最高 ×2.0）之間
    expect(decodeRun(encodeRun({ ...toSharedRun(run), parts: { depth: 1000, graze: 0, crystal: 0 } }))).toBeNull();
    expect(decodeRun(encodeRun({ ...toSharedRun(run), parts: { depth: 3000, graze: 0, crystal: 0 } }))).toBeNull();
    expect(decodeRun(encodeRun({ ...toSharedRun(run), parts: { depth: 1280, graze: 0, crystal: 0 } }))?.total).toBe(1280);
  });
});

describe("J4b 成績代碼的合理性與正規編碼（Codex 審查第 9 項）", () => {
  const ok = { depth: 100, newScore: false, newDepth: false, parts: { depth: 1000, graze: 0, crystal: 0 } };
  it("驚險分、水晶分要嘛是 0，要嘛至少一次；深度 0 不可能有大量驚險", () => {
    expect(decodeRun(encodeRun({ ...ok, parts: { ...ok.parts, graze: 50 } }))).not.toBeNull();
    expect(decodeRun(encodeRun({ ...ok, parts: { ...ok.parts, graze: 1 } }))).toBeNull();
    expect(decodeRun(encodeRun({ ...ok, parts: { ...ok.parts, crystal: 29 } }))).toBeNull();
    expect(decodeRun(encodeRun({ depth: 0, newScore: false, newDepth: false, parts: { depth: 0, graze: 1_000_000, crystal: 0 } }))).toBeNull();
    expect(decodeRun(encodeRun({ ...ok, parts: { ...ok.parts, graze: 99_999 } }))).toBeNull();
  });
  it("同一份成績只有一種寫法：改動 Base64 結尾的多餘位元，解碼回傳 null", () => {
    const code = encodeRun(ok);
    expect(decodeRun(code)).not.toBeNull();
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    // 19 個位元組的 Base64 結尾 2 個位元沒用到：最後一個字元的低 2 位元改掉，位元組不變但寫法不同
    const last = alphabet.indexOf(code[code.length - 1]);
    const altered = code.slice(0, -1) + alphabet[last ^ 1];
    expect(altered).not.toBe(code);
    expect(decodeRun(altered)).toBeNull();
  });
});

describe("M 音效混音", () => {
  it("檔案清單不重複、事件對得到音效、驚險音調隨連段升高", () => {
    expect(new Set(SOUND_FILES).size).toBe(SOUND_FILES.length);
    expect(soundFor({ type: "hurt", cause: "spike", x: 0, y: 0 })).toBe("hurt.mp3");
    expect(soundFor({ type: "land", kind: "rock", x: 0, y: 0, vy: 5 })).toBe("land.mp3");
    expect(soundFor({ type: "land", kind: "cart", x: 0, y: 0, vy: 5 })).toBe("minecart-push.mp3");
    expect(soundFor({ type: "land", kind: "spike", x: 0, y: 0, vy: 5 })).toBeNull();
    expect(soundFor({ type: "graze", source: "edge", points: 50, mult: 1, x: 0, y: 0 })).toBe("near-miss.mp3");
    expect(soundFor({ type: "graze", source: "edge", points: 60, mult: 1.2, x: 0, y: 0 })).toBe("combo-up.mp3");
    expect(soundFor({ type: "over", reason: "hp" })).toBe("game-over.mp3");
    expect(grazeRate(1)).toBe(1);
    expect(grazeRate(2)).toBeGreaterThan(grazeRate(1.2));
    expect(grazeRate(9)).toBe(1.4);
    expect(landGain(0)).toBe(0.5);
    expect(landGain(9)).toBe(1);
    expect(rumbleGain(0)).toBeGreaterThan(rumbleGain(2));
    expect(rumbleGain(3)).toBe(0);
    expect(whooshGain(6)).toBe(0);
    expect(whooshGain(9)).toBe(1);
    expect(tickTimes()).toHaveLength(14);
  });
});

describe("T 排行榜（SQL）", () => {
  let d1: D1Database;
  let raw: ReturnType<typeof sqliteD1>["raw"];
  const best = (id: string, mode: "score" | "depth", score: number, at: number) =>
    raw.prepare("INSERT INTO mine_descent_bests (player_id, mode, score, achieved_at) VALUES (?, ?, ?, ?)").run(id, mode, score, iso(at));
  beforeEach(() => {
    ({ d1, raw } = sqliteD1());
    for (const id of ["a", "b", "c", "g"]) addPlayer(raw, id, id === "g" ? "guest" : "google");
  });

  it("T1 T2 兩張榜各自排序；同值先創下的在前；每人一列；回應不帶玩家 ID", async () => {
    best("a", "score", 5000, NOW);
    best("b", "score", 5000, NOW - 1000);
    best("c", "score", 9000, NOW);
    best("g", "score", 100, NOW);
    best("a", "depth", 200, NOW);
    best("c", "depth", 150, NOW);
    const score = await readMineTop(d1, "score", NOW);
    expect(score.rows.map((r) => [r.rank, r.score])).toEqual([[1, 9000], [2, 5000], [3, 5000], [4, 100]]);
    expect(score.rows[3].guest).toBe(true);
    expect(score.total).toBe(4);
    const depth = await readMineTop(d1, "depth", NOW);
    expect(depth.rows.map((r) => r.score)).toEqual([200, 150]);
    expect(JSON.stringify(score)).not.toMatch(/"a"|player/);
    expect(parseTop(score)?.rows).toHaveLength(4);
  });

  it("T6 自己的名次：前 100 名內、沒有成績", async () => {
    best("a", "depth", 100, NOW);
    best("b", "depth", 300, NOW);
    expect(await readMineMine(d1, "depth", "a", NOW)).toEqual({ rank: 2, score: 100, total: 2, toTop100: null });
    expect(await readMineMine(d1, "depth", "c", NOW)).toEqual({ rank: null, score: null, total: 2, toTop100: null });
    expect(parseMine(await readMineMine(d1, "depth", "a", NOW))).toBeTruthy();
  });

  it("T 榜名；讀不到名次時顯示本機最佳", () => {
    expect(SCOPES).toEqual(["score", "depth"]);
    expect(isScope("daily")).toBe(false);
    expect(periodOf("depth", NOW)).toBe("");
    expect(localBest({ score: 99, depth: 7 }, "depth")).toBe(7);
    expect(localBest({ score: 99, depth: null }, "score")).toBe(99);
  });

  it("T13 訪客併進帳號：最高分與最深各取高值（同值留先創下的），訪客刪掉", async () => {
    best("a", "score", 5000, NOW);
    best("g", "score", 6000, NOW - 5);
    best("g", "depth", 250, NOW);
    best("a", "depth", 250, NOW + 7);
    raw.prepare("INSERT INTO precise_stop_bests (player_id, mode, date_key, score, achieved_at) VALUES ('g', 'free', '', 4000, ?)").run(iso(NOW));
    await mergeGuest(d1, "g", "a");
    const rows = raw.prepare("SELECT mode, score, achieved_at FROM mine_descent_bests WHERE player_id = 'a' ORDER BY mode").all();
    expect(rows).toEqual([
      { mode: "depth", score: 250, achieved_at: iso(NOW) },
      { mode: "score", score: 6000, achieved_at: iso(NOW - 5) },
    ]);
    expect(raw.prepare("SELECT COUNT(*) AS n FROM precise_stop_bests WHERE player_id = 'a'").get()).toEqual({ n: 1 });
    expect(raw.prepare("SELECT COUNT(*) AS n FROM players WHERE id = 'g'").get()).toEqual({ n: 0 });
    expect(raw.prepare("SELECT COUNT(*) AS n FROM mine_descent_bests WHERE player_id = 'g'").get()).toEqual({ n: 0 });
  });

  it("P13 刪除玩家時最佳紀錄一起刪（ON DELETE CASCADE）", () => {
    best("a", "score", 1, NOW);
    raw.prepare("DELETE FROM players WHERE id = 'a'").run();
    expect(raw.prepare("SELECT COUNT(*) AS n FROM mine_descent_bests").get()).toEqual({ n: 0 });
  });
});

describe("K SEO 與文字", () => {
  it("K3 每種語言的頁面標題、描述、canonical；成績連結只有成績圖與 noindex", () => {
    for (const locale of LOCALES) {
      const meta = gameMetadata(locale, "mine-descent");
      expect(meta.title).toBe(dictionaries[locale].mineDescent.title);
      expect(meta.description).toBe(dictionaries[locale].mineDescent.metaDescription);
      expect(meta.canonical).toContain("/games/mine-descent");
    }
    const code = encodeRun(toSharedRun({ depth: 100, newScore: false, newDepth: false, parts: { depth: 1000, graze: 100, crystal: 30 } }));
    const shared = sharedMetadata("en", "mine-descent", code);
    expect(shared.noindex).toBe(true);
    expect(JSON.stringify(shared.openGraph)).toContain(`/en/games/mine-descent/r/${code}/card`);
    expect(sharedBanner("en", code)).toContain("1,130");
    expect(sharedBanner("en", "bad")).toBeNull();
    expect(sharedMetadata("en", "mine-descent", "bad").noindex).toBe(true);
  });
  it("K5 五段深度每種語言都有名稱與說明", () => {
    for (const locale of LOCALES) {
      const zones = dictionaries[locale].mineDescent.zones;
      expect(zones, locale).toHaveLength(5);
      for (const zone of zones) expect(zone.name && zone.hint).toBeTruthy();
    }
  });
});
