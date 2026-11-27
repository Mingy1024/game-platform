import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { iso, sqliteD1 } from "@/lib/__tests__/d1-sqlite";
import {
  PLAY_COUNT_MIN_DISPLAY,
  PURGE_PLAY_BATCHES_SQL,
  isPlayCountGame,
  parsePlayBody,
  readPlayCount,
  recordPlay,
  shouldShowPlayCount,
} from "..";
import { fetchPlayCount, reportPlay } from "../client";

const DAY = 86_400_000;
const NOW = Date.now();
const RUN = (n: number) => `run-${String(n).padStart(16, "0")}`;

let d1: D1Database;
let raw: ReturnType<typeof sqliteD1>["raw"];
beforeEach(() => {
  ({ d1, raw } = sqliteD1());
});

describe("遊玩次數：記一局（觸發器）", () => {
  it("每個新代碼加一，各遊戲分開累計", async () => {
    expect(await readPlayCount(d1, "precise-stop")).toBe(0);
    expect(await recordPlay(d1, "precise-stop", RUN(1), NOW)).toBe(true);
    expect(await recordPlay(d1, "precise-stop", RUN(2), NOW)).toBe(true);
    expect(await recordPlay(d1, "mine-descent", RUN(3), NOW)).toBe(true);
    expect(await readPlayCount(d1, "precise-stop")).toBe(2);
    expect(await readPlayCount(d1, "mine-descent")).toBe(1);
    expect(await readPlayCount(d1, "office-escape")).toBe(0);
  });

  it("同一個代碼重送只加一次（sync-checklist 第 3 節）", async () => {
    expect(await recordPlay(d1, "office-escape", RUN(1), NOW)).toBe(true);
    expect(await recordPlay(d1, "office-escape", RUN(1), NOW)).toBe(false);
    expect(await recordPlay(d1, "office-escape", RUN(1), NOW + 1000)).toBe(false);
    expect(await readPlayCount(d1, "office-escape")).toBe(1);
  });

  it("同一個代碼拿去別的遊戲也不會加", async () => {
    await recordPlay(d1, "precise-stop", RUN(1), NOW);
    expect(await recordPlay(d1, "mine-descent", RUN(1), NOW)).toBe(false);
    expect(await readPlayCount(d1, "mine-descent")).toBe(0);
  });

  it("同時送出多個請求不會少算", async () => {
    await Promise.all(Array.from({ length: 20 }, (_, i) => recordPlay(d1, "precise-stop", RUN(i), NOW)));
    expect(await readPlayCount(d1, "precise-stop")).toBe(20);
  });

  it("計數表只存遊戲代號與總數，代碼表不存玩家或 IP", () => {
    const columns = (table: string) => (raw.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
    expect(columns("play_counts")).toEqual(["game", "count"]);
    expect(columns("play_count_batches")).toEqual(["run_id", "game", "created_at"]);
  });
});

describe("遊玩次數：每日清理", () => {
  it("清掉 2 天前的代碼，總數不變；還在保留期的代碼照樣擋重複", async () => {
    raw.prepare("INSERT INTO play_count_batches (run_id, game, created_at) VALUES (?, ?, ?)").run(RUN(1), "precise-stop", iso(NOW - 3 * DAY));
    await recordPlay(d1, "precise-stop", RUN(2), NOW - DAY);
    expect(await readPlayCount(d1, "precise-stop")).toBe(2);

    raw.exec(PURGE_PLAY_BATCHES_SQL);
    const left = (raw.prepare("SELECT run_id FROM play_count_batches").all() as { run_id: string }[]).map((r) => r.run_id);
    expect(left).toEqual([RUN(2)]);
    expect(await readPlayCount(d1, "precise-stop")).toBe(2);
    expect(await recordPlay(d1, "precise-stop", RUN(2), NOW)).toBe(false);
  });
});

describe("遊玩次數：檢查", () => {
  it("只接受站上有的遊戲", () => {
    expect(isPlayCountGame("precise-stop")).toBe(true);
    expect(isPlayCountGame("office-escape")).toBe(true);
    expect(isPlayCountGame("mine-descent")).toBe(true);
    expect(isPlayCountGame("nope")).toBe(false);
    expect(isPlayCountGame("")).toBe(false);
    expect(isPlayCountGame(undefined)).toBe(false);
  });

  it("runId 格式：16–64 個 [A-Za-z0-9_-]", () => {
    expect(parsePlayBody({ runId: "a".repeat(16) })).toEqual({ runId: "a".repeat(16) });
    expect(parsePlayBody({ runId: "a".repeat(64) })).toEqual({ runId: "a".repeat(64) });
    expect(parsePlayBody({ runId: "a".repeat(15) })).toBeNull();
    expect(parsePlayBody({ runId: "a".repeat(65) })).toBeNull();
    expect(parsePlayBody({ runId: "bad id with spaces!!" })).toBeNull();
    expect(parsePlayBody({ runId: 123 })).toBeNull();
    expect(parsePlayBody(null)).toBeNull();
    expect(parsePlayBody("x")).toBeNull();
  });

  it(`少於 ${PLAY_COUNT_MIN_DISPLAY} 次不顯示`, () => {
    expect(PLAY_COUNT_MIN_DISPLAY).toBe(100);
    expect(shouldShowPlayCount(99)).toBe(false);
    expect(shouldShowPlayCount(100)).toBe(true);
    expect(shouldShowPlayCount(128_406)).toBe(true);
    expect(shouldShowPlayCount(null)).toBe(false);
    expect(shouldShowPlayCount(undefined)).toBe(false);
    expect(shouldShowPlayCount(Number.NaN)).toBe(false);
  });
});

describe("遊玩次數：前端", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("功能關閉時不送", () => {
    reportPlay("precise-stop", false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("每次只送一個請求、帶新的代碼，失敗不重送", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    reportPlay("mine-descent", true);
    reportPlay("mine-descent", true);
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/play-count/mine-descent");
    expect(init.method).toBe("POST");
    const ids = fetchMock.mock.calls.map(([, i]) => (JSON.parse((i as RequestInit).body as string) as { runId: string }).runId);
    expect(parsePlayBody({ runId: ids[0] })).not.toBeNull();
    expect(ids[0]).not.toBe(ids[1]);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("讀取失敗或格式不對回 null", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ count: 321 }), { status: 200 }));
    expect(await fetchPlayCount("precise-stop")).toBe(321);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "not_found" }), { status: 404 }));
    expect(await fetchPlayCount("precise-stop")).toBeNull();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ count: "lots" }), { status: 200 }));
    expect(await fetchPlayCount("precise-stop")).toBeNull();
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    expect(await fetchPlayCount("precise-stop")).toBeNull();
  });
});
