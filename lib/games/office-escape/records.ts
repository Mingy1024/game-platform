import { taiwanDateKey } from "./route";
import type { Records } from "./types";

export type { Records };

/**
 * 本機最佳紀錄：每天的最佳分（依台灣日期）和歷史最佳。
 * 瀏覽器不允許儲存（無痕模式、關閉 Cookie）時，讀寫都安靜地失敗，遊戲照常能玩（J2）。
 */
const KEY = "game-station:office-escape:v1";
/** 每日紀錄只留最近這麼多天 */
export const KEEP_DAYS = 14;

export const emptyRecords = (): Records => ({ daily: {}, best: null });

export type Store = Pick<Storage, "getItem" | "setItem">;

export function getStore(): Store | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function parseRecords(raw: string | null): Records {
  if (!raw) return emptyRecords();
  try {
    const data = JSON.parse(raw) as Partial<Records>;
    const daily: Record<string, number> = {};
    if (data.daily && typeof data.daily === "object") {
      for (const [key, value] of Object.entries(data.daily)) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(key) && Number.isFinite(value) && value >= 0) daily[key] = value;
      }
    }
    return { daily, best: typeof data.best === "number" && Number.isFinite(data.best) && data.best >= 0 ? data.best : null };
  } catch {
    return emptyRecords();
  }
}

export function loadRecords(store: Store | null = getStore()): Records {
  if (!store) return emptyRecords();
  try {
    return parseRecords(store.getItem(KEY));
  } catch {
    return emptyRecords();
  }
}

/** 今天的最佳分；沒玩過是 null */
export const todayBest = (records: Records, now = Date.now()): number | null => records.daily[taiwanDateKey(now)] ?? null;

export type SaveOutcome = {
  records: Records;
  /** 這一局之前的歷史最佳 */
  previousBest: number | null;
  /** 超過歷史最佳（第一局也算）。結算只在這一局當下算一次，之後同步不會改它 */
  isNewRecord: boolean;
  /** 有沒有成功寫進瀏覽器 */
  saved: boolean;
};

/** 套用一局的結果，回傳新的紀錄（不寫入） */
export function applyRun(records: Records, run: { dateKey: string; total: number }): Omit<SaveOutcome, "saved"> {
  const previousBest = records.best;
  const isNewRecord = previousBest === null || run.total > previousBest;
  const daily = { ...records.daily };
  if (run.total > (daily[run.dateKey] ?? -1)) daily[run.dateKey] = run.total;
  return {
    records: trimDaily({ daily, best: isNewRecord ? run.total : previousBest }),
    previousBest,
    isNewRecord,
  };
}

export function saveRun(run: { dateKey: string; total: number }, store: Store | null = getStore()): SaveOutcome {
  const outcome = applyRun(loadRecords(store), run);
  let saved = false;
  if (store) {
    try {
      store.setItem(KEY, JSON.stringify(outcome.records));
      saved = true;
    } catch {
      saved = false;
    }
  }
  return { ...outcome, saved };
}

/** 只留最近 KEEP_DAYS 天的每日紀錄 */
export function trimDaily(records: Records): Records {
  const keys = Object.keys(records.daily).sort();
  const drop = new Set(keys.slice(0, Math.max(0, keys.length - KEEP_DAYS)));
  return { ...records, daily: Object.fromEntries(Object.entries(records.daily).filter(([key]) => !drop.has(key))) };
}

/** 整份換掉（帳號紀錄同步回來時）。回傳有沒有成功寫進瀏覽器 */
export function writeRecords(records: Records, store: Store | null = getStore()): boolean {
  if (!store) return false;
  try {
    store.setItem(KEY, JSON.stringify(trimDaily(records)));
    return true;
  } catch {
    return false;
  }
}

/** 兩份紀錄各取高分 */
export function mergeRecords(a: Records, b: Records): Records {
  const daily = { ...a.daily };
  for (const [key, score] of Object.entries(b.daily)) daily[key] = Math.max(daily[key] ?? 0, score);
  const best = a.best === null ? b.best : b.best === null ? a.best : Math.max(a.best, b.best);
  return trimDaily({ daily, best });
}

export const RECORDS_KEY = KEY;
