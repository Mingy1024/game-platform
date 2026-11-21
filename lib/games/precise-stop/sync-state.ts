import {
  dedupeBests,
  isAcceptable,
  MAX_PERFECT_DELTA,
  MAX_RUN_SCORE,
  MAX_SYNC_BESTS,
  overlay,
  type AccountRecords,
  type BestEntry,
} from "./account-records";
import { trimDaily, type Records, type Store } from "./records";

/**
 * 還沒存到帳號的紀錄（帳號設計稿第 11.4 節）。純邏輯，存在本機的另一個 key。
 *
 * - pending：還沒送出的部分。每一局都把完美次數加進來，破紀錄時把那一筆最佳加進來。
 *   沒登入時玩的也記在這裡，登入時一起併進帳號（第 15 題）。
 * - outbox：正在送、或送了沒收到回應的那一批，帶著固定的 syncId。
 *   重送時用同一個 syncId，伺服器就不會重複加完美次數；收到成功回應才清掉。
 *   送出時記下 sentAt：瀏覽器不支援 Web Locks 時，同一個瀏覽器的其他分頁在 LOCK_MS 內不會再送同一批。
 * - inbox：剛玩完的每一局各存成獨立的一個 key（INBOX_PREFIX＋隨機代碼）。
 *   同步時（在 Web Lock 裡）才收進 pending、刪掉那幾個 key。玩完一局不必改共用的 KEY，
 *   另一個分頁正在套用同步結果時，也不會把剛玩完的這局蓋掉。
 */
const KEY = "game-station:precise-stop:sync:v1";
export const LOCK_MS = 20_000;

export type Batch = { bests: BestEntry[]; perfectDelta: number };
/**
 * owner：第一次送出時登入的帳號（站內玩家 ID）。換了帳號就不再重送，避免送進別的帳號。
 * ambiguous：送出過但沒收到明確結果（逾時、伺服器錯誤），伺服器可能已經寫入
 */
export type Outbox = Batch & { id: string; sentAt: number | null; owner?: string; ambiguous?: boolean };
export type SyncState = { pending: Batch; outbox: Outbox | null };

const emptyBatch = (): Batch => ({ bests: [], perfectDelta: 0 });
export const emptySyncState = (): SyncState => ({ pending: emptyBatch(), outbox: null });

const INBOX_PREFIX = "game-station:precise-stop:run:";
type InboxStore = Store & Pick<Storage, "removeItem" | "key" | "length">;
/** 瀏覽器不允許儲存時，剛玩完的局記在這一頁的記憶體裡 */
const memoryInbox = new Map<string, Batch>();

/** 把剛玩完的一局放進 inbox */
export function addToInbox(store: InboxStore | null, batch: Batch, id: string) {
  if (store) {
    try {
      store.setItem(INBOX_PREFIX + id, JSON.stringify(batch));
      return;
    } catch {
      // 寫不進去就記在記憶體
    }
  }
  memoryInbox.set(id, batch);
}

/** inbox 裡所有的局合成一批；keys 是收進來的那些 key（之後用 removeInbox 刪掉） */
export function readInbox(store: InboxStore | null): { batch: Batch; keys: string[] } {
  const batches: Batch[] = [...memoryInbox.values()];
  const keys: string[] = [...memoryInbox.keys()].map((id) => `memory:${id}`);
  if (store) {
    try {
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i);
        if (!key?.startsWith(INBOX_PREFIX)) continue;
        try {
          const batch = JSON.parse(store.getItem(key) ?? "") as unknown;
          if (isBatch(batch)) batches.push(batch);
        } catch {
          // 壞掉的就丟掉
        }
        keys.push(key);
      }
    } catch {
      // 讀不到就只有記憶體裡的
    }
  }
  return {
    batch: {
      bests: dedupeBests(batches.flatMap((batch) => batch.bests)),
      perfectDelta: batches.reduce((sum, batch) => sum + batch.perfectDelta, 0),
    },
    keys,
  };
}

export function removeInbox(store: InboxStore | null, keys: string[]) {
  for (const key of keys) {
    if (key.startsWith("memory:")) {
      memoryInbox.delete(key.slice("memory:".length));
      continue;
    }
    try {
      store?.removeItem(key);
    } catch {
      // 刪不掉的下次再收一次：最佳紀錄取高分沒影響，完美次數會多算，但寫得進去就刪得掉
    }
  }
}

/** 把 inbox 那一批併進 pending */
export function withInbox(state: SyncState, inbox: Batch): SyncState {
  if (inbox.bests.length === 0 && inbox.perfectDelta === 0) return state;
  return {
    ...state,
    pending: {
      bests: dedupeBests([...state.pending.bests, ...inbox.bests]),
      perfectDelta: state.pending.perfectDelta + inbox.perfectDelta,
    },
  };
}

/**
 * 瀏覽器不允許儲存時，改記在這一頁的記憶體裡。
 * 寫入失敗過（例如空間滿了）就以記憶體這份為準，直到下次寫入成功，不會讀回比較舊的那份。
 */
let memory: SyncState | null = null;
let memoryAhead = false;

/**
 * 本機還沒有這份資料（這個功能上線前就玩過）：把現有的本機紀錄整份當作還沒上傳，
 * 第一次登入時才能併進帳號。
 */
export function fromRecords(records: Records, now: number): SyncState {
  const bests: BestEntry[] = Object.entries(records.daily).map(([dateKey, score]) => ({
    mode: "daily",
    dateKey,
    score,
    achievedAt: now,
  }));
  if (records.free !== null) bests.push({ mode: "free", dateKey: null, score: records.free, achievedAt: now });
  // 舊的本機紀錄沒有檢查過：分數超出範圍的不送（送了會讓整批被拒絕）
  const valid = bests.filter((entry) => Number.isInteger(entry.score) && entry.score >= 0 && entry.score <= MAX_RUN_SCORE);
  return { pending: { bests: valid, perfectDelta: Math.max(0, Math.floor(records.perfectStops)) }, outbox: null };
}

function isBatch(value: unknown): value is Batch {
  if (!value || typeof value !== "object") return false;
  const batch = value as Partial<Batch>;
  return Array.isArray(batch.bests) && typeof batch.perfectDelta === "number";
}

function parse(raw: string): SyncState | null {
  try {
    const data = JSON.parse(raw) as Partial<SyncState>;
    if (!isBatch(data.pending)) return null;
    const outbox = data.outbox && isBatch(data.outbox) && typeof data.outbox.id === "string" ? data.outbox : null;
    return { pending: data.pending, outbox };
  } catch {
    return null;
  }
}

export function loadSyncState(store: Store | null, records: Records, now: number): SyncState {
  if (!store) return (memory ??= fromRecords(records, now));
  if (memoryAhead && memory) return memory;
  try {
    const raw = store.getItem(KEY);
    const parsed = raw ? parse(raw) : null;
    if (parsed) return parsed;
    const initial = fromRecords(records, now);
    saveSyncState(store, initial);
    return initial;
  } catch {
    return (memory ??= fromRecords(records, now));
  }
}

/** 回傳有沒有寫進瀏覽器（沒有 store 時是 false）。寫不進去就只記在記憶體 */
export function saveSyncState(store: Store | null, state: SyncState): boolean {
  memory = state;
  if (!store) return false;
  try {
    store.setItem(KEY, JSON.stringify(state));
    memoryAhead = false;
    return true;
  } catch {
    memoryAhead = true;
    return false;
  }
}

/** 登出、刪除帳號時清空（第 16 題） */
export function resetSyncState(store: Store | null) {
  saveSyncState(store, emptySyncState());
}

/** 其他分頁登出時：這一頁記憶體裡的那份（儲存失敗時的退路）也是舊帳號的，丟掉 */
export function forgetMemory() {
  forgetStateMemory();
  memoryInbox.clear();
}

/** 只丟掉記憶體裡的同步狀態，之後從瀏覽器裡最後存好的那份重讀（inbox 不動） */
export function forgetStateMemory() {
  memory = null;
  memoryAhead = false;
}

type Run = { mode: BestEntry["mode"]; dateKey: string | null; total: number; perfectStops: number; isNewRecord: boolean };

/**
 * 一局要上傳的內容：完美次數和這局的分數。分數不管本機算不算破紀錄都送：
 * 本機顯示的紀錄可能是別的帳號留下的（登入過期時不清），讓伺服器取高分決定（同一天同一模式只留最高的一筆）
 */
export function runBatch(run: Run, now: number): Batch {
  const bests: BestEntry[] = [
    { mode: run.mode, dateKey: run.mode === "free" ? null : run.dateKey, score: run.total, achievedAt: now },
  ];
  return { bests, perfectDelta: run.perfectStops };
}

/** 記下一局（直接併進 pending；實際玩完一局時用 addToInbox） */
export const addRun = (state: SyncState, run: Run, now: number): SyncState => withInbox(state, runBatch(run, now));

const isEmpty = (batch: Batch) => batch.bests.length === 0 && batch.perfectDelta === 0;

/** 濾掉伺服器不會收的最佳紀錄（超過 14 天的今日挑戰）；它們也不會顯示在帳號紀錄裡 */
export function prune(state: SyncState, now: number): SyncState {
  const bests = state.pending.bests.filter((entry) => isAcceptable(entry, now));
  return bests.length === state.pending.bests.length ? state : { ...state, pending: { ...state.pending, bests } };
}

/** 還有沒存到帳號的紀錄嗎（登出提醒用，P11）。先用 prune 濾掉過期的 */
export const hasUnsynced = (state: SyncState) => state.outbox !== null || !isEmpty(state.pending);

/**
 * 準備要送的一批：上次沒送成的 outbox 優先；沒有的話從 pending 搬一批進新的 outbox。
 * 搬的時候濾掉伺服器不會收的（超過 14 天的今日挑戰），超過上限（15 筆、完美次數 10,000）的留在 pending 下一批送，
 * 才不會因為其中一筆讓整批被拒絕、連帶丟掉其他紀錄。
 * 其他分頁正在送（sentAt 在 LOCK_MS 內）時回傳 null。
 */
export function takeOutbox(
  state: SyncState,
  now: number,
  newId: () => string,
  { exclusive = false, owner }: { exclusive?: boolean; owner?: string } = {},
): { state: SyncState; outbox: Outbox } | null {
  state = dropForeignOutbox(state, owner);
  if (state.outbox) {
    // exclusive：已經拿到 Web Lock，不會有別的分頁正在送（sentAt 可能是重新整理前那一頁留下的），直接重送
    if (!exclusive && state.outbox.sentAt !== null && now - state.outbox.sentAt < LOCK_MS) return null;
    // 重送前也濾掉這段期間過期的今日挑戰：最佳紀錄取高分可以重複套用，完美次數靠同一個 syncId 擋重複，
    // 所以拿掉一筆再送也安全；不拿掉的話伺服器會整批拒絕
    const outbox = {
      ...state.outbox,
      bests: state.outbox.bests.filter((entry) => isAcceptable(entry, now)),
      sentAt: now,
      owner: state.outbox.owner ?? owner,
    };
    return { state: { ...state, outbox }, outbox };
  }
  const valid = prune(state, now).pending.bests;
  const perfectDelta = Math.min(state.pending.perfectDelta, MAX_PERFECT_DELTA);
  const bests = valid.slice(0, MAX_SYNC_BESTS);
  const rest: Batch = { bests: valid.slice(MAX_SYNC_BESTS), perfectDelta: state.pending.perfectDelta - perfectDelta };
  if (bests.length === 0 && perfectDelta === 0) return null;
  const outbox: Outbox = { bests, perfectDelta, id: newId(), sentAt: now, owner };
  return { state: { pending: rest, outbox }, outbox };
}

/**
 * 上次送給別的帳號、還沒收到回應的那一批：可能已經存進那個帳號了，不能再送給現在的帳號，丟掉。
 * 從沒送出過的 pending 不受影響，照樣併進現在登入的帳號（P13）
 */
export function dropForeignOutbox(state: SyncState, owner: string | undefined): SyncState {
  return state.outbox?.owner && owner && state.outbox.owner !== owner ? { ...state, outbox: null } : state;
}

/** 那一批已經存到帳號：清掉 outbox */
export function confirmOutbox(state: SyncState, id: string): SyncState {
  return state.outbox?.id === id ? { ...state, outbox: null } : state;
}

/**
 * 伺服器說這一批不合理（400，例如手機時鐘快了超過一天）：最佳紀錄不再送，
 * 完美次數照樣用同一個 syncId 再送（只有完美次數的一批不會被拒絕），不會連帶丟掉
 */
export function rejectOutboxBests(state: SyncState, id: string): SyncState {
  if (state.outbox?.id !== id) return state;
  return { ...state, outbox: state.outbox.perfectDelta > 0 ? { ...state.outbox, bests: [], sentAt: null } : null };
}

/** 送出失敗（網路、伺服器錯誤）：保留 outbox，解除鎖定，記下「伺服器可能已經寫入」，之後重送同一批 */
export function releaseOutbox(state: SyncState, id: string): SyncState {
  return state.outbox?.id === id ? { ...state, outbox: { ...state.outbox, sentAt: null, ambiguous: true } } : state;
}

/**
 * 伺服器確定沒寫入（409 帳號不符）：之前沒有過不明確的結果，就把這一批放回 pending、拿掉帳號標記，
 * 之後照「從沒送過」的規則併進目前登入的帳號（P13）。之前有過不明確的結果（可能已經存進原本的帳號），只解除鎖定
 */
export function returnOutbox(state: SyncState, id: string): SyncState {
  const outbox = state.outbox;
  if (outbox?.id !== id) return state;
  if (outbox.ambiguous) return { ...state, outbox: { ...outbox, sentAt: null } };
  return { pending: withInbox(state, outbox).pending, outbox: null };
}

/**
 * 伺服器回來的帳號紀錄，疊上還沒存到帳號的部分，就是這台裝置要顯示的紀錄。
 * 本機只留最近 14 天的每日紀錄。
 */
export function displayRecords(account: AccountRecords, state: SyncState): Records {
  const pending = [...state.pending.bests, ...(state.outbox?.bests ?? [])];
  const delta = state.pending.perfectDelta + (state.outbox?.perfectDelta ?? 0);
  return trimDaily(overlay(account, pending, delta));
}
