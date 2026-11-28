import { compareRuns } from "./scoring";
import { isMode, type Mode } from "./tower";
import type { AccountRecords, Best, Records } from "./types";

export type { Best, Records };

/**
 * 本機最佳紀錄（J1）：固定關卡與隨機模式各自的最佳分數＋時間、最高到達層數。
 * 瀏覽器不允許儲存（無痕模式、關閉 Cookie）時，讀寫都安靜地失敗，遊戲照常能玩（J2）。
 */
const KEY = "game-station:monk-soup-tower:v1";
/** 送達塔頂時記的「層數」：比第 5 層高一格 */
export const SUMMIT_FLOOR = 6;

export const emptyRecords = (): Records => ({ fixed: null, random: null, floors: { fixed: null, random: null } });

export type Store = Pick<Storage, "getItem" | "setItem">;

export function getStore(): Store | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

const int = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

export function parseBest(value: unknown): Best | null {
  const v = value as Partial<Best> | null;
  return v && int(v.score, 0, 1000) && int(v.timeMs, 0, 24 * 3600 * 1000) ? { score: v.score, timeMs: v.timeMs } : null;
}

export function parseRecords(raw: string | null): Records {
  if (!raw) return emptyRecords();
  try {
    const data = JSON.parse(raw) as Partial<Records>;
    const floor = (mode: Mode) => (int(data.floors?.[mode], 1, SUMMIT_FLOOR) ? data.floors![mode] : null);
    return { fixed: parseBest(data.fixed), random: parseBest(data.random), floors: { fixed: floor("fixed"), random: floor("random") } };
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

/** 一局的結果：送達塔頂才有 best（分數與時間）；失敗只更新最高到達層數 */
export type RunRecord = { mode: Mode; floor: number; best: Best | null };

export type SaveOutcome = {
  records: Records;
  /** 這一局之前的最佳 */
  previous: Records;
  /** 破了這個模式的最佳分數（第一局也算；同分時間短也算；完全平手不算） */
  newBest: boolean;
  /** 到達更高的層數 */
  newFloor: boolean;
  /** 有沒有成功寫進瀏覽器 */
  saved: boolean;
};

/** a 比 b 好嗎（分數高、同分時間短）；平手不算 */
export const better = (a: Best, b: Best | null): boolean => b === null || compareRuns(a, b) < 0;

/** 套用一局的結果，回傳新的紀錄（不寫入） */
export function applyRun(records: Records, run: RunRecord): Omit<SaveOutcome, "saved"> {
  const current = records[run.mode];
  const newBest = run.best !== null && better(run.best, current);
  const floorBefore = records.floors[run.mode];
  const newFloor = floorBefore === null || run.floor > floorBefore;
  return {
    records: {
      ...records,
      [run.mode]: newBest ? run.best : current,
      floors: { ...records.floors, [run.mode]: newFloor ? run.floor : floorBefore },
    },
    previous: records,
    newBest,
    newFloor,
  };
}

/** base：目前以哪一份紀錄為準（儲存失敗時是記憶體裡的那份）；沒給就讀磁碟 */
export function saveRun(run: RunRecord, store: Store | null = getStore(), base?: Records): SaveOutcome {
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

const bestOf = (a: Best | null, b: Best | null): Best | null => (a === null ? b : b === null ? a : better(b, a) ? b : a);
const higher = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : Math.max(a, b));

/** 帳號紀錄和本機紀錄各取最佳；層數只有本機有 */
export const mergeRecords = (account: AccountRecords, local: Records): Records => ({
  fixed: bestOf(account.fixed, local.fixed),
  random: bestOf(account.random, local.random),
  floors: { fixed: higher(null, local.floors.fixed), random: higher(null, local.floors.random) },
});

export const isRecordMode = isMode;
export const RECORDS_KEY = KEY;
