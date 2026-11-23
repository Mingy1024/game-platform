import type { Records } from "./types";

export type { Records };

/**
 * 本機最佳紀錄：最高分和最深的深度。
 * 瀏覽器不允許儲存（無痕模式、關閉 Cookie）時，讀寫都安靜地失敗，遊戲照常能玩（J2）。
 */
const KEY = "game-station:mine-descent:v1";

export const emptyRecords = (): Records => ({ score: null, depth: null });

export type Store = Pick<Storage, "getItem" | "setItem">;

export function getStore(): Store | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

const valid = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;

export function parseRecords(raw: string | null): Records {
  if (!raw) return emptyRecords();
  try {
    const data = JSON.parse(raw) as Partial<Records>;
    return { score: valid(data.score) ? data.score : null, depth: valid(data.depth) ? data.depth : null };
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

export type SaveOutcome = {
  records: Records;
  /** 這一局之前的最佳 */
  previous: Records;
  /** 超過最高分／最深的深度（第一局也算）。結算只在這一局當下算一次，之後同步不會改它 */
  newScore: boolean;
  newDepth: boolean;
  /** 有沒有成功寫進瀏覽器 */
  saved: boolean;
};

/** 套用一局的結果，回傳新的紀錄（不寫入） */
export function applyRun(records: Records, run: { depth: number; total: number }): Omit<SaveOutcome, "saved"> {
  const newScore = records.score === null || run.total > records.score;
  const newDepth = records.depth === null || run.depth > records.depth;
  return {
    records: { score: newScore ? run.total : records.score, depth: newDepth ? run.depth : records.depth },
    previous: records,
    newScore,
    newDepth,
  };
}

/** base：目前以哪一份紀錄為準（儲存失敗時是記憶體裡的那份，不能讀回磁碟上比較舊的）；沒給就讀磁碟 */
export function saveRun(run: { depth: number; total: number }, store: Store | null = getStore(), base?: Records): SaveOutcome {
  const outcome = applyRun(base ?? loadRecords(store), run);
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

/** 整份換掉（帳號紀錄同步回來時）。回傳有沒有成功寫進瀏覽器 */
export function writeRecords(records: Records, store: Store | null = getStore()): boolean {
  if (!store) return false;
  try {
    store.setItem(KEY, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}

const higher = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : Math.max(a, b));

/** 兩份紀錄各取高分 */
export const mergeRecords = (a: Records, b: Records): Records => ({ score: higher(a.score, b.score), depth: higher(a.depth, b.depth) });

export const RECORDS_KEY = KEY;
