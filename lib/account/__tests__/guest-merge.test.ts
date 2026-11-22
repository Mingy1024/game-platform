import { beforeEach, describe, expect, it } from "vitest";
import { addBest, addPlayer, iso, sqliteD1 } from "@/lib/__tests__/d1-sqlite";
import { consentRequiredFor } from "../consent-region";
import { mergeGuest, PURGE_GUESTS_SQL } from "../guest-merge";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 22, 4);

let d1: D1Database;
let raw: ReturnType<typeof sqliteD1>["raw"];
beforeEach(() => {
  ({ d1, raw } = sqliteD1());
  addPlayer(raw, "acct", "google");
  addPlayer(raw, "guest", "guest");
});

const bests = (id: string) =>
  raw.prepare("SELECT mode, date_key, score, achieved_at FROM precise_stop_bests WHERE player_id = ? ORDER BY mode, date_key").all(id);
const perfect = (id: string) =>
  (raw.prepare("SELECT perfect_stops FROM precise_stop_stats WHERE player_id = ?").get(id) as { perfect_stops: number } | undefined)?.perfect_stops ?? 0;
const addBatch = (id: string, syncId: string, delta: number) =>
  raw.prepare("INSERT INTO precise_stop_sync_batches (player_id, sync_id, perfect_delta, created_at) VALUES (?, ?, ?, ?)").run(id, syncId, delta, iso(NOW));

describe("T13 訪客併進 Google 帳號", () => {
  it("最佳紀錄取高分（同分留先創下的）、完美次數相加、訪客刪掉", async () => {
    addBest(raw, "acct", "daily", "2026-11-22", 3000, NOW);
    addBest(raw, "guest", "daily", "2026-11-22", 4000, NOW - 1000);
    addBest(raw, "acct", "free", "", 5000, NOW);
    addBest(raw, "guest", "free", "", 4500, NOW - 5000);
    addBest(raw, "acct", "daily", "2026-11-21", 2000, NOW);
    addBest(raw, "guest", "daily", "2026-11-21", 2000, NOW - DAY);
    addBest(raw, "guest", "daily", "2026-11-20", 1500, NOW - 2 * DAY);
    addBatch("acct", "batch-acct-01", 2);
    addBatch("guest", "batch-guest-1", 5);

    await mergeGuest(d1, "guest", "acct");

    expect(bests("acct")).toEqual([
      { mode: "daily", date_key: "2026-11-20", score: 1500, achieved_at: iso(NOW - 2 * DAY) },
      { mode: "daily", date_key: "2026-11-21", score: 2000, achieved_at: iso(NOW - DAY) },
      { mode: "daily", date_key: "2026-11-22", score: 4000, achieved_at: iso(NOW - 1000) },
      { mode: "free", date_key: "", score: 5000, achieved_at: iso(NOW) },
    ]);
    expect(perfect("acct")).toBe(7);
    expect(raw.prepare("SELECT COUNT(*) AS n FROM players WHERE id = 'guest'").get()).toEqual({ n: 0 });
    expect(bests("guest")).toEqual([]);
  });

  it("批次代碼搬進帳號、完美次數記 0：之後同一批送給帳號也不會重複加（T14）", async () => {
    addBatch("guest", "batch-shared1", 3);
    await mergeGuest(d1, "guest", "acct");
    expect(perfect("acct")).toBe(3);
    expect(raw.prepare("SELECT perfect_delta FROM precise_stop_sync_batches WHERE player_id = 'acct' AND sync_id = 'batch-shared1'").get()).toEqual({
      perfect_delta: 0,
    });
    // 帳號已經有這一批：重送時撞到主鍵，觸發器不會再加
    expect(() => addBatch("acct", "batch-shared1", 3)).toThrow();
    expect(perfect("acct")).toBe(3);
  });

  it("重複執行（另一個請求剛併過）什麼都不會多加", async () => {
    addBest(raw, "guest", "free", "", 4500, NOW);
    addBatch("guest", "batch-twice01", 4);
    await mergeGuest(d1, "guest", "acct");
    await mergeGuest(d1, "guest", "acct");
    expect(perfect("acct")).toBe(4);
  });

  it("對方不是訪客時不動", async () => {
    addPlayer(raw, "other", "google");
    addBest(raw, "other", "free", "", 5900, NOW);
    await mergeGuest(d1, "other", "acct");
    expect(bests("acct")).toEqual([]);
    expect(raw.prepare("SELECT COUNT(*) AS n FROM players WHERE id = 'other'").get()).toEqual({ n: 1 });
  });
});

describe("T16 每日排程刪掉 90 天沒玩的訪客", () => {
  it("只刪 90 天沒玩的訪客，紀錄和 session 一起刪；Google 帳號不動", () => {
    const now = Date.now();
    addPlayer(raw, "old-guest", "guest", { lastSeen: now - 91 * DAY });
    addPlayer(raw, "old-acct", "google", { lastSeen: now - 200 * DAY });
    addPlayer(raw, "new-guest", "guest", { lastSeen: now - 10 * DAY });
    addBest(raw, "old-guest", "free", "", 3000, now - 91 * DAY);
    raw.prepare("INSERT INTO sessions (id, player_id, expires_at, created_at) VALUES ('h', 'old-guest', ?, ?)").run(iso(now + DAY), iso(now));
    const result = raw.prepare(PURGE_GUESTS_SQL).run();
    expect(Number(result.changes)).toBe(1);
    const ids = raw.prepare("SELECT id FROM players ORDER BY id").all().map((row) => (row as { id: string }).id);
    expect(ids).toEqual(["acct", "guest", "new-guest", "old-acct"]);
    expect(raw.prepare("SELECT COUNT(*) AS n FROM precise_stop_bests").get()).toEqual({ n: 0 });
    expect(raw.prepare("SELECT COUNT(*) AS n FROM sessions").get()).toEqual({ n: 0 });
  });
});

describe("T11 要先問同意的地區", () => {
  it("歐洲經濟區、英國、瑞士要問；台灣、美國、讀不到國家不用", () => {
    for (const code of ["DE", "fr", "IS", "NO", "LI", "GB", "CH"]) expect(consentRequiredFor(code)).toBe(true);
    for (const code of ["TW", "US", "JP", "TR", null, undefined, ""]) expect(consentRequiredFor(code)).toBe(false);
  });
});
