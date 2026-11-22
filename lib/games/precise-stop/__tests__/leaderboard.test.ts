import { beforeEach, describe, expect, it } from "vitest";
import { addBest, addPlayer, sqliteD1 } from "@/lib/__tests__/d1-sqlite";
import { readMine, readTop } from "@/server/utils/leaderboard";
import { avatarColor, AVATAR_COLORS, parseMine, parseTop, periodOf, pointsToTop, weekRange } from "../leaderboard";
import { localBest } from "../leaderboard-client";

const DAY = 86_400_000;
/** 台灣時間 2026-11-22（週日）中午 */
const NOW = Date.UTC(2026, 10, 22, 4);

describe("T1 三張榜的期間", () => {
  it("本週是台灣時間週一到週日", () => {
    expect(weekRange("2026-11-22")).toEqual({ from: "2026-11-16", to: "2026-11-22" });
    expect(weekRange("2026-11-16")).toEqual({ from: "2026-11-16", to: "2026-11-22" });
    expect(weekRange("2026-11-23")).toEqual({ from: "2026-11-23", to: "2026-11-29" });
    expect(weekRange("2027-01-01")).toEqual({ from: "2026-12-28", to: "2027-01-03" });
  });
  it("期間依台灣日期：UTC 16:00 就是台灣的隔天", () => {
    expect(periodOf("daily", Date.UTC(2026, 10, 22, 15, 59))).toBe("2026-11-22");
    expect(periodOf("daily", Date.UTC(2026, 10, 22, 16, 0))).toBe("2026-11-23");
    // 週日 24 點（台灣）＝週一 0 點：換成新的一週
    expect(periodOf("week", Date.UTC(2026, 10, 22, 16, 0))).toBe("2026-11-23");
    expect(periodOf("free", NOW)).toBe("");
  });
});

describe("T1 T2 T5 前 100 名與自己的名次（node:sqlite 跑同樣的 migrations）", () => {
  let d1: D1Database;
  let raw: ReturnType<typeof sqliteD1>["raw"];
  beforeEach(() => {
    ({ d1, raw } = sqliteD1());
    for (const id of ["a", "b", "c", "d"]) addPlayer(raw, id, id === "c" ? "guest" : "google", { custom: id.toUpperCase() });
  });

  it("今日挑戰：只算今天；分數高的在前、同分時先創下的在前；訪客標示；不帶玩家 ID", async () => {
    addBest(raw, "a", "daily", "2026-11-22", 4000, NOW - 3000);
    addBest(raw, "b", "daily", "2026-11-22", 5000, NOW - 2000);
    addBest(raw, "c", "daily", "2026-11-22", 4000, NOW - 5000);
    addBest(raw, "d", "daily", "2026-11-21", 5900, NOW - DAY);
    const top = await readTop(d1, "daily", NOW);
    expect(top.total).toBe(3);
    expect(top.period).toBe("2026-11-22");
    expect(top.rows.map((row) => [row.rank, row.nick.custom, row.score, row.guest])).toEqual([
      [1, "B", 5000, false],
      [2, "C", 4000, true],
      [3, "A", 4000, false],
    ]);
    expect(JSON.stringify(top)).not.toMatch(/"(a|b|c|d)"/);
    expect(top.rows[0]!.color).toBe(avatarColor("b"));
  });

  it("本週：每人只出現一次，取本週單局最高分（同分留最早的一天）；上週的不算", async () => {
    addBest(raw, "a", "daily", "2026-11-16", 3000, NOW - 6 * DAY);
    addBest(raw, "a", "daily", "2026-11-20", 4200, NOW - 2 * DAY);
    addBest(raw, "a", "daily", "2026-11-22", 4200, NOW);
    addBest(raw, "b", "daily", "2026-11-15", 5900, NOW - 7 * DAY);
    addBest(raw, "b", "daily", "2026-11-18", 4100, NOW - 4 * DAY);
    const top = await readTop(d1, "week", NOW);
    expect(top.total).toBe(2);
    expect(top.rows.map((row) => [row.nick.custom, row.score, row.achievedAt])).toEqual([
      ["A", 4200, new Date(NOW - 2 * DAY).toISOString()],
      ["B", 4100, new Date(NOW - 4 * DAY).toISOString()],
    ]);
    expect(await readMine(d1, "week", "b", NOW)).toEqual({ rank: 2, score: 4100, total: 2, toTop100: null });
  });

  it("自由模式：歷史最佳；沒有成績時 rank 是 null", async () => {
    addBest(raw, "a", "free", "", 3000, NOW - 10 * DAY);
    expect((await readTop(d1, "free", NOW)).rows.map((row) => row.score)).toEqual([3000]);
    expect(await readMine(d1, "free", "b", NOW)).toEqual({ rank: null, score: null, total: 1, toTop100: null });
  });

  it("名次和前 100 名的順序一致；100 名外算出還差幾分", async () => {
    for (let i = 0; i < 105; i++) {
      addPlayer(raw, `p${String(i).padStart(3, "0")}`, "google");
      addBest(raw, `p${String(i).padStart(3, "0")}`, "daily", "2026-11-22", 5000 - i * 10, NOW - 1000);
    }
    const top = await readTop(d1, "daily", NOW);
    expect(top.rows).toHaveLength(100);
    expect(top.total).toBe(105);
    expect(top.rows[99]!.score).toBe(4010);
    expect(await readMine(d1, "daily", "p000", NOW)).toEqual({ rank: 1, score: 5000, total: 105, toTop100: null });
    expect(await readMine(d1, "daily", "p099", NOW)).toEqual({ rank: 100, score: 4010, total: 105, toTop100: null });
    expect(await readMine(d1, "daily", "p104", NOW)).toEqual({ rank: 105, score: 3960, total: 105, toTop100: 51 });
  });
});

describe("T6 你的名次", () => {
  it("再 N 分：比第 100 名多 1 分", () => {
    expect(pointsToTop(4510, 128, 4601)).toBe(92);
    expect(pointsToTop(4601, 101, 4601)).toBe(1);
    expect(pointsToTop(4700, 37, 4601)).toBeNull();
  });
  it("讀不到名次時的最佳分：本週取本機紀錄裡本週的最高分", () => {
    const records = { daily: { "2026-11-15": 5900, "2026-11-17": 3000, "2026-11-22": 2000 }, free: 4000, perfectStops: 0 };
    expect(localBest(records, "daily", NOW)).toBe(2000);
    expect(localBest(records, "week", NOW)).toBe(3000);
    expect(localBest(records, "free", NOW)).toBe(4000);
    expect(localBest({ daily: {}, free: null, perfectStops: 0 }, "week", NOW)).toBeNull();
  });
});

describe("T7 回應格式檢查", () => {
  it("格式不對當作讀不到", () => {
    expect(parseTop({ scope: "daily", period: "x", total: 0, rows: [] })).not.toBeNull();
    expect(parseTop({ scope: "daily", total: 0, rows: [] })).toBeNull();
    expect(parseTop(null)).toBeNull();
    expect(parseMine({ rank: null, score: null, total: 3, toTop100: null })).not.toBeNull();
    expect(parseMine({ rank: 0, score: 1, total: 3, toTop100: null })).toBeNull();
  });
  it("頭像底色編號在範圍內、同一個玩家固定", () => {
    expect(avatarColor("abc")).toBe(avatarColor("abc"));
    for (const id of ["a", "bb", "player-xyz", ""]) expect(avatarColor(id)).toBeLessThan(AVATAR_COLORS.length);
  });
});
