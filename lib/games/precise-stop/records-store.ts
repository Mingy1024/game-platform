import { randomId } from "@/lib/account/crypto";
import { emptyRecords, getStore, loadRecords, saveRun, writeRecords, type Records, type SaveOutcome } from "./records";
import type { Mode } from "./route";
import {
  addToInbox,
  forgetStateMemory,
  loadSyncState,
  prune,
  readInbox,
  removeInbox,
  resetSyncState,
  runBatch,
  saveSyncState,
  withInbox,
  type SyncState,
} from "./sync-state";

/**
 * 讓介紹頁和遊戲畫面共用同一份本機紀錄：
 * 一局結束寫入後，介紹頁的看板會立刻顯示新的最佳成績。
 * 登入時，這份紀錄由帳號同步（account-sync.ts）換成帳號的紀錄；登出時清空。
 * 純邏輯，只在瀏覽器端呼叫；伺服器端與第一次畫面一律用 EMPTY_RECORDS。
 */
const listeners = new Set<() => void>();
/** 這一頁玩完一局時通知（只有新的一局，不含同步寫入、其他分頁的變動），帳號同步用它觸發上傳 */
const runListeners = new Set<() => void>();
export const EMPTY_RECORDS = emptyRecords();
let cache: Records | null = null;

export function readRecords(): Records {
  if (!cache) cache = loadRecords();
  return cache;
}

function notify() {
  for (const listener of listeners) listener();
}

export function subscribeRecords(listener: () => void) {
  listeners.add(listener);
  // 其他分頁寫入時也跟著更新
  const onStorage = () => {
    cache = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function inboxStore(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** 共用 KEY 裡存的那份（還沒併進 inbox）。只在同步的 Web Lock 裡改它 */
export const loadStoredSyncState = (): SyncState => loadSyncState(getStore(), readRecords(), Date.now());
/** 回傳有沒有寫進瀏覽器；瀏覽器完全不能儲存（無痕）時也算寫好，因為沒有其他分頁共用 */
export function writeSyncState(state: SyncState): boolean {
  const store = getStore();
  return saveSyncState(store, state) || !store;
}

/**
 * 還沒存到帳號的全部紀錄（共用 KEY＋inbox，濾掉過期的今日挑戰）。只讀，不寫回：
 * 寫入只在同步的 Web Lock 裡做（collectInbox），避免和另一個分頁同時改共用 KEY。
 */
export function readSyncState(): SyncState {
  return prune(withInbox(loadStoredSyncState(), readInbox(inboxStore()).batch), Date.now());
}

/**
 * 在同步的 Web Lock 裡：把 inbox 收進共用 KEY、刪掉收進來的 key，回傳收完的狀態。
 * 寫不進瀏覽器時回傳 null，這一輪就不送：inbox 原封不動留著當唯一的來源，
 * 不然收進記憶體的那份送出後，下一輪又會從 inbox 收到同一局、用新的 syncId 再送一次
 */
export function collectInbox(): SyncState | null {
  const store = inboxStore();
  const inbox = readInbox(store);
  const stored = loadStoredSyncState();
  const state = prune(withInbox(stored, inbox.batch), Date.now());
  if (state === stored) return state;
  if (!writeSyncState(state)) {
    // 還原記憶體裡的那份，下一輪從最後存好的狀態重收
    forgetStateMemory();
    return null;
  }
  removeInbox(store, inbox.keys);
  return state;
}

export function subscribeRuns(listener: () => void) {
  runListeners.add(listener);
  return () => {
    runListeners.delete(listener);
  };
}

export function recordRun(run: {
  mode: Mode;
  dateKey: string | null;
  total: number;
  perfectStops: number;
}): SaveOutcome {
  // 先讀一次，讓這個功能上線前就有的本機紀錄先轉成「還沒上傳」，才不會連這一局重複算
  loadStoredSyncState();
  const outcome = saveRun(run);
  cache = outcome.records;
  // 這一局獨立存成一個 inbox key，不改共用的同步狀態（sync-state.ts）
  addToInbox(inboxStore(), runBatch({ ...run, isNewRecord: outcome.isNewRecord }, Date.now()), randomId());
  notify();
  for (const listener of runListeners) listener();
  return outcome;
}

/** 整份換成新的紀錄（帳號紀錄同步回來時） */
export function replaceRecords(next: Records) {
  writeRecords(next);
  cache = next;
  notify();
}

/** 清掉這台裝置的精準停車紀錄和還沒上傳的部分（登出、刪除帳號時，第 16 題） */
export function clearLocalRecords() {
  const store = getStore();
  writeRecords(emptyRecords(), store);
  resetSyncState(store);
  const inbox = inboxStore();
  removeInbox(inbox, readInbox(inbox).keys);
  cache = emptyRecords();
  notify();
}
