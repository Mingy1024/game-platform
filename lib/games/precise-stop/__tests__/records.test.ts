import { describe, expect, it } from "vitest";
import { applyRun, bestOf, emptyRecords, loadRecords, parseRecords, saveRun } from "../records";

function memoryStore(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

describe("J1 本機紀錄", () => {
  it("今日挑戰依日期、自由模式各自分開記", () => {
    const store = memoryStore();
    saveRun({ mode: "daily", dateKey: "2026-11-15", total: 4510, perfectStops: 2 }, store);
    saveRun({ mode: "free", dateKey: null, total: 5310, perfectStops: 3 }, store);
    const records = loadRecords(store);
    expect(bestOf(records, "daily", "2026-11-15")).toBe(4510);
    expect(bestOf(records, "daily", "2026-11-16")).toBeNull();
    expect(bestOf(records, "free", null)).toBe(5310);
    expect(records.perfectStops).toBe(5);
  });

  it("只有更高分才更新，並回報是否破紀錄", () => {
    const store = memoryStore();
    const first = saveRun({ mode: "daily", dateKey: "2026-11-15", total: 4510, perfectStops: 0 }, store);
    expect(first).toMatchObject({ isNewRecord: true, previousBest: null, saved: true });
    const lower = saveRun({ mode: "daily", dateKey: "2026-11-15", total: 4000, perfectStops: 0 }, store);
    expect(lower).toMatchObject({ isNewRecord: false, previousBest: 4510 });
    const higher = saveRun({ mode: "daily", dateKey: "2026-11-15", total: 4746, perfectStops: 0 }, store);
    expect(higher).toMatchObject({ isNewRecord: true, previousBest: 4510 });
    expect(bestOf(loadRecords(store), "daily", "2026-11-15")).toBe(4746);
  });

  it("舊日期的今日挑戰紀錄只留最近 14 天", () => {
    let records = emptyRecords();
    for (let day = 1; day <= 20; day++) {
      const dateKey = `2026-11-${String(day).padStart(2, "0")}`;
      records = applyRun(records, { mode: "daily", dateKey, total: 100, perfectStops: 0 }).records;
    }
    expect(Object.keys(records.daily)).toHaveLength(14);
    expect(records.daily["2026-11-20"]).toBe(100);
    expect(records.daily["2026-11-06"]).toBeUndefined();
  });
});

describe("J2 不能儲存時遊戲照常運作", () => {
  it("沒有儲存空間時回傳空紀錄，不丟錯誤", () => {
    expect(loadRecords(null)).toEqual(emptyRecords());
    const outcome = saveRun({ mode: "free", dateKey: null, total: 1000, perfectStops: 1 }, null);
    expect(outcome).toMatchObject({ saved: false, isNewRecord: true });
  });

  it("讀寫丟錯誤時安靜地失敗", () => {
    const broken = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(loadRecords(broken)).toEqual(emptyRecords());
    expect(saveRun({ mode: "free", dateKey: null, total: 1, perfectStops: 0 }, broken).saved).toBe(false);
  });

  it("內容損毀時當作沒有紀錄", () => {
    expect(parseRecords("{not json")).toEqual(emptyRecords());
    expect(parseRecords('{"daily":{"bad":1,"2026-11-15":"x"},"free":"9","perfectStops":-3}')).toEqual(
      emptyRecords(),
    );
  });
});
