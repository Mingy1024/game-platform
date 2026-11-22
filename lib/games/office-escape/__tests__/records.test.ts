import { beforeEach, describe, expect, it } from "vitest";
import { addPlayer, iso, sqliteD1 } from "@/lib/__tests__/d1-sqlite";
import { mergeGuest } from "@/lib/account/guest-merge";
import { readOfficeMine, readOfficeTop } from "@/server/utils/leaderboard";
import { MAX_RUN_SCORE, dedupeBests, dailyWindow, isAcceptable, overlay, parseAccountRecords, parseSyncBody, type BestEntry } from "../account-records";
import { SEGMENTS } from "../config";
import { SCOPES, isScope, parseMine, parseTop, periodOf } from "../leaderboard";
import { localBest } from "../leaderboard-client";
import { applyRun, emptyRecords, mergeRecords, parseRecords, saveRun, trimDaily, type Store } from "../records";
import { LAYOUT } from "../route";
import { loadSeen, recordSeen } from "../seen";
import { clockFromTenths, decodeRun, encodeRun, toSharedRun } from "../share-code";
import { SOUND_FILES, endingSound, grazeRate, runLevel, soundFor, tickTimes } from "../sound-mix";
import { zhTW } from "@/lib/i18n/dictionaries/zh-TW";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { LOCALES } from "@/lib/i18n/locales";
import { gameMetadata, sharedBanner, sharedMetadata } from "../meta";
import { PENDING_KEY, addToInbox, loadPending, parsePending, prune, readInbox, removeConfirmed, removeInbox, runEntries, savePending, withBests } from "../sync-state";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 22, 4);
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
  it("今日（依台灣日期）和歷史最佳分開；破紀錄才覆寫；第一局算新紀錄", () => {
    const first = applyRun(emptyRecords(), { dateKey: "2026-11-22", total: 3000 });
    expect(first).toMatchObject({ previousBest: null, isNewRecord: true });
    expect(first.records).toEqual({ daily: { "2026-11-22": 3000 }, best: 3000 });
    const lower = applyRun(first.records, { dateKey: "2026-11-23", total: 2000 });
    expect(lower.isNewRecord).toBe(false);
    expect(lower.records).toEqual({ daily: { "2026-11-22": 3000, "2026-11-23": 2000 }, best: 3000 });
    const equal = applyRun(lower.records, { dateKey: "2026-11-23", total: 3000 });
    expect(equal.isNewRecord).toBe(false);
    expect(equal.records.daily["2026-11-23"]).toBe(3000);
  });
  it("存進 localStorage、讀得回來；壞資料當作空的；只留 14 天", () => {
    const store = memory();
    expect(saveRun({ dateKey: "2026-11-22", total: 100 }, store)).toMatchObject({ saved: true });
    expect(parseRecords(store.getItem("game-station:office-escape:v1"))).toEqual({ daily: { "2026-11-22": 100 }, best: 100 });
    expect(parseRecords("{壞掉")).toEqual(emptyRecords());
    const many = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`2026-10-${String(i + 1).padStart(2, "0")}`, i]));
    expect(Object.keys(trimDaily({ daily: many, best: 1 }).daily)).toHaveLength(14);
    expect(mergeRecords({ daily: { "2026-11-22": 1 }, best: 5 }, { daily: { "2026-11-22": 9 }, best: null })).toEqual({ daily: { "2026-11-22": 9 }, best: 5 });
  });
  it("J2 不能儲存時照常能算（saved: false）", () => {
    const broken = { getItem: () => null, setItem: () => { throw new Error("quota"); } } as Store;
    expect(saveRun({ dateKey: "2026-11-22", total: 100 }, broken)).toMatchObject({ saved: false, isNewRecord: true });
    expect(saveRun({ dateKey: "2026-11-22", total: 100 }, null)).toMatchObject({ saved: false });
  });
});

describe("D6 台詞庫", () => {
  it("記下看過的台詞，回傳這局新看到幾句；壞資料不算", () => {
    const store = memory();
    expect(recordSeen(["coworker:1", "boss:2", "group:3"], store)).toBe(3);
    expect(recordSeen(["coworker:1", "boss:5"], store)).toBe(1);
    expect(loadSeen(store).sort()).toEqual(["boss:2", "boss:5", "coworker:1", "group:3"]);
    expect(recordSeen(["x:1", "boss:999"], store)).toBe(0);
  });
});

describe("P4 帳號紀錄的檢查", () => {
  const ok = (over: object = {}) => ({ syncId: "abcdefgh1234", playerId: "p1", bests: [{ mode: "all", dateKey: null, score: 100, achievedAt: NOW }], ...over });
  it("分數上限由路線算出，且不小於時間分上限", () => {
    expect(MAX_RUN_SCORE).toBeGreaterThan(SEGMENTS.reduce((s, x) => s + x.target * 100, 0) * 2);
    expect(MAX_RUN_SCORE).toBeGreaterThan(LAYOUT.obstacles.length);
  });
  it("格式或分數範圍不對整批拒絕", () => {
    expect(parseSyncBody(ok(), NOW)?.bests).toHaveLength(1);
    expect(parseSyncBody(ok({ bests: [{ mode: "all", dateKey: null, score: MAX_RUN_SCORE + 1, achievedAt: NOW }] }), NOW)).toBeNull();
    expect(parseSyncBody(ok({ bests: [{ mode: "all", dateKey: "2026-11-22", score: 1, achievedAt: NOW }] }), NOW)).toBeNull();
    expect(parseSyncBody(ok({ bests: [{ mode: "daily", dateKey: null, score: 1, achievedAt: NOW }] }), NOW)).toBeNull();
    expect(parseSyncBody(ok({ bests: [{ mode: "free", dateKey: null, score: 1, achievedAt: NOW }] }), NOW)).toBeNull();
    expect(parseSyncBody(ok({ bests: Array.from({ length: 16 }, () => ({ mode: "all", dateKey: null, score: 1, achievedAt: NOW })) }), NOW)).toBeNull();
    expect(parseSyncBody(ok({ syncId: "x" }), NOW)).toBeNull();
    expect(parseSyncBody(ok({ extra: 1 }), NOW)).toBeNull();
  });
  it("時間不對的只略過那一筆：日期不存在、超過 14 天、比現在晚超過 1 天", () => {
    const body = parseSyncBody(
      ok({
        bests: [
          { mode: "daily", dateKey: "2026-02-31", score: 1, achievedAt: NOW },
          { mode: "daily", dateKey: "2026-11-07", score: 1, achievedAt: NOW },
          { mode: "daily", dateKey: "2026-11-23", score: 5, achievedAt: NOW },
          { mode: "daily", dateKey: "2026-11-25", score: 1, achievedAt: NOW },
          { mode: "all", dateKey: null, score: 9, achievedAt: NOW + 3 * DAY },
          { mode: "daily", dateKey: "2026-11-22", score: 7, achievedAt: NOW },
        ],
      }),
      NOW,
    );
    expect(body?.bests.map((b) => `${b.mode}:${b.dateKey}:${b.score}`)).toEqual(["daily:2026-11-23:5", "daily:2026-11-22:7"]);
    expect(dailyWindow(NOW)).toEqual({ from: "2026-11-08", to: "2026-11-22" });
    expect(isAcceptable({ mode: "daily", dateKey: "2026-11-08", score: 1, achievedAt: NOW }, NOW)).toBe(true);
  });
  it("同一種、同一天只留高分，同分留先創下的；疊到帳號紀錄上各取高分", () => {
    const entries: BestEntry[] = [
      { mode: "all", dateKey: null, score: 10, achievedAt: 5 },
      { mode: "all", dateKey: null, score: 10, achievedAt: 3 },
      { mode: "all", dateKey: null, score: 8, achievedAt: 1 },
      { mode: "daily", dateKey: "2026-11-22", score: 4, achievedAt: 9 },
    ];
    expect(dedupeBests(entries)).toEqual([entries[1], entries[3]]);
    expect(overlay({ daily: { "2026-11-22": 9 }, best: 5 }, entries)).toEqual({ daily: { "2026-11-22": 9 }, best: 10 });
    expect(parseAccountRecords({ daily: { "2026-11-22": 1 }, best: null })).toEqual({ daily: { "2026-11-22": 1 }, best: null });
    expect(parseAccountRecords({ daily: {}, best: "x" })).toBeNull();
  });
});

describe("P 待上傳的狀態（冪等的取高分，不需要批次代碼）", () => {
  it("一局產生今天與歷史最佳兩筆候選；inbox 收進 pending 後刪掉來源", () => {
    const store = memory();
    addToInbox(store, runEntries({ dateKey: "2026-11-22", total: 500 }, NOW), "a");
    addToInbox(store, runEntries({ dateKey: "2026-11-22", total: 900 }, NOW + 1), "b");
    const inbox = readInbox(store);
    expect(inbox.keys).toHaveLength(2);
    const state = withBests(loadPending(store, () => "guest-sync-0001"), inbox.batch);
    expect(state.bests.map((b) => b.score)).toEqual([900, 900]);
    expect(savePending(store, state)).toBe(true);
    removeInbox(store, inbox.keys);
    expect(readInbox(store).keys).toEqual([]);
    expect(parsePending(store.getItem(PENDING_KEY))).toEqual(state);
  });
  it("送出成功只移除分數不高於送出那筆的（送出期間新增的更高分留著）", () => {
    const sent = runEntries({ dateKey: "2026-11-22", total: 500 }, NOW);
    const state = withBests({ guestSyncId: "guest-sync-0001", bests: sent }, runEntries({ dateKey: "2026-11-22", total: 700 }, NOW + 5));
    expect(removeConfirmed(state, sent).bests.map((b) => b.score)).toEqual([700, 700]);
    expect(removeConfirmed({ guestSyncId: "guest-sync-0001", bests: sent }, sent).bests).toEqual([]);
  });
  it("過期的濾掉；壞資料與不合格的 guestSyncId 當作沒有；不能儲存時記在記憶體", () => {
    const old = runEntries({ dateKey: "2026-10-01", total: 5 }, NOW);
    expect(prune({ guestSyncId: "guest-sync-0001", bests: old }, NOW).bests).toEqual([old[1]]);
    expect(parsePending("{}")).toBeNull();
    expect(parsePending(JSON.stringify({ guestSyncId: "短", bests: [] }))).toBeNull();
    expect(savePending(null, { guestSyncId: "guest-sync-0002", bests: [] })).toBe(false);
    expect(loadPending(null, () => "unused-id-1234").guestSyncId).toBe("guest-sync-0002");
    savePending(memory(), { guestSyncId: "guest-sync-0003", bests: [] });
  });
});

describe("J4 J7 成績代碼", () => {
  const run = { dateKey: "2026-11-22", newRecord: true, ending: "fast" as const, hidden: false, clockTicks: 47 * 120, parts: { time: 2000, graze: 105, event: 400, item: 40 } };
  it("編碼後解碼，總分用計分規則重算（×2.0）", () => {
    const code = encodeRun(toSharedRun(run));
    const decoded = decodeRun(code)!;
    expect(decoded).toMatchObject({ dateKey: "2026-11-22", ending: "fast", hidden: false, newRecord: true, clockTenths: 470, total: 5090 });
    expect(clockFromTenths(decoded.clockTenths)).toBe("18:00:47");
  });
  it("被改過、格式不對、結局和時鐘對不上都回傳 null，不丟錯誤", () => {
    const code = encodeRun(toSharedRun(run));
    expect(decodeRun(code.slice(0, -2) + "AA")).toBeNull();
    expect(decodeRun("")).toBeNull();
    expect(decodeRun("%%%")).toBeNull();
    expect(decodeRun("x".repeat(100))).toBeNull();
    expect(decodeRun(encodeRun({ ...toSharedRun(run), ending: "fast", clockTenths: 700 }))).toBeNull();
    expect(decodeRun(encodeRun({ ...toSharedRun(run), ending: "overtime", hidden: true, clockTenths: 950 }))).toBeNull();
    expect(decodeRun(encodeRun({ ...toSharedRun(run), ending: "overtime", hidden: false, clockTenths: 900 }))?.total).toBe(2545);
  });
});

describe("M 音效混音", () => {
  it("檔案清單不重複、事件對得到音效、擦身音調隨連段升高", () => {
    expect(new Set(SOUND_FILES).size).toBe(SOUND_FILES.length);
    expect(soundFor({ type: "lane", to: 1 })).toBe("lane.mp3");
    expect(soundFor({ type: "pickup", item: "dnd", id: 1 })).toBe("pickup-dnd.mp3");
    expect(soundFor({ type: "answer", grade: 2, points: 0 })).toBe("answer-wrong.mp3");
    expect(endingSound("fast", true)).toBe("ending-hidden.mp3");
    expect(grazeRate(1)).toBe(1);
    expect(grazeRate(5)).toBeGreaterThan(grazeRate(2));
    expect(grazeRate(99)).toBe(1.5);
    expect(runLevel(0).gain).toBe(0);
    expect(runLevel(8.4).rate).toBeGreaterThan(runLevel(6).rate);
    expect(tickTimes()).toHaveLength(14);
  });
});

describe("T 排行榜（SQL）", () => {
  let d1: D1Database;
  let raw: ReturnType<typeof sqliteD1>["raw"];
  const best = (id: string, mode: "daily" | "all", dateKey: string, score: number, at: number) =>
    raw.prepare("INSERT INTO office_escape_bests (player_id, mode, date_key, score, achieved_at) VALUES (?, ?, ?, ?, ?)").run(id, mode, dateKey, score, iso(at));
  beforeEach(() => {
    ({ d1, raw } = sqliteD1());
    for (const id of ["a", "b", "c", "g"]) addPlayer(raw, id, id === "g" ? "guest" : "google");
  });

  it("T1 T2 三張榜：今日只算今天、本週取每人最高、歷史最佳；同分先創下的在前；每人一列", async () => {
    best("a", "daily", "2026-11-22", 3000, NOW);
    best("b", "daily", "2026-11-22", 3000, NOW - 1000);
    best("c", "daily", "2026-11-21", 9000, NOW - DAY);
    best("c", "daily", "2026-11-23", 100, NOW);
    best("a", "all", "", 5000, NOW);
    best("c", "all", "", 9000, NOW);
    best("g", "all", "", 5000, NOW - 10);
    const daily = await readOfficeTop(d1, "daily", NOW);
    expect(daily.rows.map((r) => [r.rank, r.score])).toEqual([[1, 3000], [2, 3000]]);
    expect(daily.total).toBe(2);
    const week = await readOfficeTop(d1, "week", NOW);
    expect(week.rows.map((r) => r.score)).toEqual([9000, 3000, 3000]);
    expect(week.period).toBe("2026-11-16");
    const all = await readOfficeTop(d1, "all", NOW);
    expect(all.rows.map((r) => r.score)).toEqual([9000, 5000, 5000]);
    expect(all.rows[1].guest).toBe(true);
    expect(JSON.stringify(all)).not.toMatch(/"a"|player/);
    expect(parseTop(all)?.rows).toHaveLength(3);
  });

  it("T6 自己的名次：前 100 名內、沒有成績", async () => {
    best("a", "all", "", 5000, NOW);
    best("b", "all", "", 7000, NOW);
    expect(await readOfficeMine(d1, "all", "a", NOW)).toEqual({ rank: 2, score: 5000, total: 2, toTop100: null });
    expect(await readOfficeMine(d1, "all", "c", NOW)).toEqual({ rank: null, score: null, total: 2, toTop100: null });
    expect(parseMine(await readOfficeMine(d1, "all", "a", NOW))).toBeTruthy();
  });

  it("T 榜名與期間；本機最佳在讀不到名次時顯示", () => {
    expect(SCOPES).toEqual(["daily", "week", "all"]);
    expect(isScope("free")).toBe(false);
    expect(periodOf("all", NOW)).toBe("");
    expect(localBest({ daily: { "2026-11-22": 10, "2026-11-17": 30 }, best: 99 }, "week", NOW)).toBe(30);
    expect(localBest({ daily: { "2026-11-22": 10 }, best: 99 }, "daily", NOW)).toBe(10);
    expect(localBest({ daily: {}, best: 99 }, "all", NOW)).toBe(99);
  });

  it("T13 訪客併進帳號：兩款遊戲的最佳都併（取高分、同分留先創下的），訪客刪掉", async () => {
    best("a", "all", "", 5000, NOW);
    best("g", "all", "", 6000, NOW - 5);
    best("g", "daily", "2026-11-22", 2500, NOW);
    best("a", "daily", "2026-11-22", 2500, NOW + 7);
    raw.prepare("INSERT INTO precise_stop_bests (player_id, mode, date_key, score, achieved_at) VALUES ('g', 'free', '', 4000, ?)").run(iso(NOW));
    await mergeGuest(d1, "g", "a");
    const rows = raw.prepare("SELECT mode, date_key, score, achieved_at FROM office_escape_bests WHERE player_id = 'a' ORDER BY mode, date_key").all();
    expect(rows).toEqual([
      { mode: "all", date_key: "", score: 6000, achieved_at: iso(NOW - 5) },
      { mode: "daily", date_key: "2026-11-22", score: 2500, achieved_at: iso(NOW) },
    ]);
    expect(raw.prepare("SELECT COUNT(*) AS n FROM precise_stop_bests WHERE player_id = 'a'").get()).toEqual({ n: 1 });
    expect(raw.prepare("SELECT COUNT(*) AS n FROM players WHERE id = 'g'").get()).toEqual({ n: 0 });
    expect(raw.prepare("SELECT COUNT(*) AS n FROM office_escape_bests WHERE player_id = 'g'").get()).toEqual({ n: 0 });
  });

  it("P13 刪除玩家時最佳紀錄一起刪（ON DELETE CASCADE）", () => {
    best("a", "all", "", 1, NOW);
    raw.prepare("DELETE FROM players WHERE id = 'a'").run();
    expect(raw.prepare("SELECT COUNT(*) AS n FROM office_escape_bests").get()).toEqual({ n: 0 });
  });
});

describe("K 台詞與 SEO", () => {
  it("K5 每個語言三個台詞庫各 20 句，每句都有提問與三個不同的選項", () => {
    for (const locale of LOCALES) {
      const lines = dictionaries[locale].officeEscape.lines;
      for (const pool of ["coworker", "boss", "group"] as const) {
        expect(lines[pool], `${locale} ${pool}`).toHaveLength(20);
        for (const line of lines[pool]) {
          expect(line, `${locale} ${pool}`).toHaveLength(4);
          expect(new Set(line.slice(1)).size, `${locale} ${line[0]}`).toBe(3);
        }
      }
    }
    expect(zhTW.officeEscape.lines.boss).toHaveLength(20);
  });
  it("K3 每種語言的頁面標題、描述、canonical 與 hreflang；成績連結只有成績圖與 noindex", () => {
    for (const locale of LOCALES) {
      const meta = gameMetadata(locale, "office-escape");
      expect(meta.title).toBe(dictionaries[locale].officeEscape.title);
      expect(meta.description).toBe(dictionaries[locale].officeEscape.metaDescription);
      expect(meta.canonical).toContain("/games/office-escape");
    }
    const code = encodeRun(toSharedRun({ dateKey: "2026-11-22", newRecord: false, ending: "ontime", hidden: false, clockTicks: 80 * 120, parts: { time: 1000, graze: 0, event: 300, item: 0 } }));
    const shared = sharedMetadata("en", "office-escape", code);
    expect(shared.noindex).toBe(true);
    expect(JSON.stringify(shared.openGraph)).toContain(`/en/games/office-escape/r/${code}/card`);
    expect(sharedBanner("en", code)).toContain("1,950");
    expect(sharedBanner("en", "bad")).toBeNull();
    expect(sharedMetadata("en", "office-escape", "bad").noindex).toBe(true);
  });
});
