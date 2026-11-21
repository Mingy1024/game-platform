import type { Mode } from "./route";

/**
 * 本機最佳紀錄。今日挑戰依台灣日期分開記，自由模式記一筆。
 * 瀏覽器不允許儲存（無痕模式、關閉 Cookie）時，讀寫都安靜地失敗，遊戲照常能玩。
 */
const KEY = "game-station:precise-stop:v1";
/** 今日挑戰的舊日期只留最近這麼多筆 */
const KEEP_DAYS = 14;

export type Records = {
  daily: Record<string, number>;
  free: number | null;
  /** 累計完美停車次數 */
  perfectStops: number;
};

export const emptyRecords = (): Records => ({ daily: {}, free: null, perfectStops: 0 });

type Store = Pick<Storage, "getItem" | "setItem">;

function getStore(): Store | null {
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
        if (/^\d{4}-\d{2}-\d{2}$/.test(key) && Number.isFinite(value)) daily[key] = value;
      }
    }
    return {
      daily,
      free: typeof data.free === "number" && Number.isFinite(data.free) ? data.free : null,
      perfectStops:
        typeof data.perfectStops === "number" && data.perfectStops >= 0
          ? Math.floor(data.perfectStops)
          : 0,
    };
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

export function bestOf(records: Records, mode: Mode, dateKey: string | null): number | null {
  if (mode === "free") return records.free;
  return dateKey ? (records.daily[dateKey] ?? null) : null;
}

export type SaveOutcome = {
  records: Records;
  previousBest: number | null;
  isNewRecord: boolean;
  /** 有沒有成功寫進瀏覽器 */
  saved: boolean;
};

/** 套用一局的結果，回傳新的紀錄（不寫入） */
export function applyRun(
  records: Records,
  run: { mode: Mode; dateKey: string | null; total: number; perfectStops: number },
): Omit<SaveOutcome, "saved"> {
  const previousBest = bestOf(records, run.mode, run.dateKey);
  const isNewRecord = previousBest === null || run.total > previousBest;
  const next: Records = {
    daily: { ...records.daily },
    free: records.free,
    perfectStops: records.perfectStops + run.perfectStops,
  };
  if (isNewRecord) {
    if (run.mode === "free") next.free = run.total;
    else if (run.dateKey) next.daily[run.dateKey] = run.total;
  }
  const keys = Object.keys(next.daily).sort();
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- 只保留最近 KEEP_DAYS 天的每日紀錄
  for (const key of keys.slice(0, Math.max(0, keys.length - KEEP_DAYS))) delete next.daily[key];
  return { records: next, previousBest, isNewRecord };
}

export function saveRun(
  run: { mode: Mode; dateKey: string | null; total: number; perfectStops: number },
  store: Store | null = getStore(),
): SaveOutcome {
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

export const RECORDS_KEY = KEY;
