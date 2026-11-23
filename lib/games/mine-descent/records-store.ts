import { randomId } from "@/lib/account/crypto";
import { emptyRecords, getStore, loadRecords, mergeRecords, saveRun, writeRecords, type Records, type SaveOutcome } from "./records";
import {
  addToInbox,
  forgetPendingMemory,
  loadPending,
  prune,
  readInbox,
  removeInbox,
  resetPending,
  runEntries,
  savePending,
  withBests,
  type PendingState,
} from "./sync-state";

/**
 * 讓介紹頁和遊戲畫面共用同一份本機紀錄：一局結束寫入後，介紹頁的看板會立刻顯示新的最佳成績。
 * 登入時，這份紀錄由帳號同步（account-sync.ts）換成「帳號紀錄＋還沒上傳的部分」；登出時清空。
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

export function subscribeRuns(listener: () => void) {
  runListeners.add(listener);
  return () => {
    runListeners.delete(listener);
  };
}

/** 讀共用的 pending（不寫回）。寫入只在同步的 Web Lock 裡做 */
export const loadStoredPending = (): PendingState => loadPending(getStore() as Storage | null, () => randomId());
const writePending = (state: PendingState) => savePending(getStore() as Storage | null, state) || !getStore();

/** 還沒存到帳號的全部紀錄（pending＋inbox，濾掉過期的）。只讀 */
export function readPendingView(): PendingState {
  const store = getStore() as Storage | null;
  return prune(withBests(loadStoredPending(), readInbox(store).batch), Date.now());
}

/**
 * 在同步的 Web Lock 裡：把 inbox 收進 pending、刪掉收進來的 key，回傳收完的狀態。
 * 寫不進瀏覽器時回傳 null、這一輪不送：inbox 原封不動留著當唯一的來源
 */
export function collectInbox(): PendingState | null {
  const store = getStore() as Storage | null;
  const inbox = readInbox(store);
  const stored = loadStoredPending();
  const state = prune(withBests(stored, inbox.batch), Date.now());
  if (state === stored && inbox.keys.length === 0) return state;
  if (!writePending(state)) {
    forgetPendingMemory();
    return null;
  }
  removeInbox(store, inbox.keys);
  return state;
}

export const savePendingState = writePending;

export function recordRun(run: { depth: number; total: number }): SaveOutcome {
  // 以顯示用的紀錄（記憶體）為基礎：寫不進瀏覽器時，上一局的新紀錄還在記憶體，下一局不會被磁碟上比較舊的蓋掉
  const outcome = saveRun(run, getStore(), readRecords());
  cache = outcome.records;
  // 這一局獨立存成一個 inbox key，不改共用的 pending
  addToInbox(getStore() as Storage | null, runEntries(run, Date.now()), randomId());
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

/** 和帳號紀錄各取高分後換上（送出期間本機又有更新時，不被回應蓋掉） */
export function adoptAccountRecords(account: Records) {
  replaceRecords(mergeRecords(account, loadRecords()));
}

/** 清掉這台裝置的礦坑大逃亡紀錄和還沒上傳的部分（登出、刪除帳號、刪除訪客時，第 16 題） */
export function clearLocalRecords() {
  const store = getStore() as Storage | null;
  writeRecords(emptyRecords(), store);
  resetPending(store);
  removeInbox(store, readInbox(store).keys);
  cache = emptyRecords();
  notify();
}
