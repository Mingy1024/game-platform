import { compareRuns } from "./scoring";
import { dedupeBests, isAcceptable, type BestEntry } from "./account-records";
import type { Mode } from "./tower";

/**
 * 還沒存到帳號的最佳紀錄（待上傳）。伺服器只取最佳（分數高、同分時間短），所以不需要批次代碼、不需要追蹤「送出去的是哪一批」：
 * 重送同樣的紀錄一定是冪等的（docs/plans/archive/monk-soup-tower.md 的檢查表）。
 *
 * 共用狀態與寫入者（docs/dev/sync-checklist.md 第 1 節）：
 * - pending（PENDING_KEY）：只在同步的 Web Lock 裡「讀→改→寫」（收 inbox、送出成功後移除已確認的、登出清空）。
 *   內容：guestSyncId（建立訪客時用，同一個代碼找回同一個訪客）＋ bests（固定關卡、隨機模式各留最好的一筆）。
 * - inbox（INBOX_PREFIX＋隨機代碼）：玩完一局時新增一個新 key，不改共用 key；由鎖裡的同步收走並刪除。
 *   玩完一局的當下不在鎖裡，所以只能新增、不能改 pending。
 */
export const PENDING_KEY = "game-station:monk-soup-tower:pending:v1";
export const INBOX_PREFIX = "game-station:monk-soup-tower:run:";

export type PendingState = { guestSyncId: string; bests: BestEntry[] };
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

const isEntry = (value: unknown): value is BestEntry => {
  const e = value as Partial<BestEntry> | null;
  return (
    !!e &&
    (e.mode === "fixed" || e.mode === "random") &&
    typeof e.score === "number" &&
    Number.isInteger(e.score) &&
    e.score >= 0 &&
    typeof e.timeMs === "number" &&
    Number.isInteger(e.timeMs) &&
    e.timeMs >= 0 &&
    typeof e.achievedAt === "number" &&
    Number.isFinite(e.achievedAt)
  );
};

/** 沒有存任何東西時，guestSyncId 要先決定好並存起來才送（同一次建立訪客只能用同一個代碼） */
let memory: PendingState | null = null;

export function parsePending(raw: string | null): PendingState | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<PendingState>;
    if (typeof data.guestSyncId !== "string" || !/^[A-Za-z0-9_-]{8,64}$/.test(data.guestSyncId) || !Array.isArray(data.bests)) return null;
    return { guestSyncId: data.guestSyncId, bests: dedupeBests(data.bests.filter(isEntry)) };
  } catch {
    return null;
  }
}

/** 讀共用的 pending；沒有就用 makeId 建立一份空的（還沒存，由呼叫的地方在鎖裡寫入） */
export function loadPending(store: Store | null, makeId: () => string): PendingState {
  if (memory) return memory;
  let raw: string | null = null;
  try {
    raw = store?.getItem(PENDING_KEY) ?? null;
  } catch {
    // 讀不到就當作沒有
  }
  return parsePending(raw) ?? { guestSyncId: makeId(), bests: [] };
}

/** 寫進瀏覽器；回傳有沒有成功。不能儲存時記在記憶體（這一頁還是能送） */
export function savePending(store: Store | null, state: PendingState): boolean {
  if (!store) {
    memory = state;
    return false;
  }
  try {
    store.setItem(PENDING_KEY, JSON.stringify(state));
    memory = null;
    return true;
  } catch {
    memory = state;
    return false;
  }
}

/** 登出、刪除帳號後清空（也包含記憶體那份） */
export function resetPending(store: Store | null) {
  memory = null;
  memoryInbox = [];
  try {
    store?.removeItem(PENDING_KEY);
  } catch {
    // 不能儲存就算了
  }
}

export const forgetPendingMemory = () => {
  memory = null;
};

/** 時間不合理的（手機時鐘快太多）濾掉，不拿去送、也不佔空間 */
export function prune(state: PendingState, now: number): PendingState {
  const bests = state.bests.filter((entry) => isAcceptable(entry, now));
  return bests.length === state.bests.length ? state : { ...state, bests };
}

export function withBests(state: PendingState, incoming: BestEntry[]): PendingState {
  if (incoming.length === 0) return state;
  return { ...state, bests: dedupeBests([...state.bests, ...incoming]) };
}

/** 送出成功後，移除伺服器已經確認的：同一種、不比送出的那筆好（分數更高或同分更快才留著）。送出期間新增的更好的留著 */
export function removeConfirmed(state: PendingState, sent: BestEntry[]): PendingState {
  const sentBest = new Map<Mode, BestEntry>(sent.map((e) => [e.mode, e]));
  return {
    ...state,
    bests: state.bests.filter((e) => {
      const s = sentBest.get(e.mode);
      return !s || compareRuns(e, s) < 0;
    }),
  };
}

/** 一局送達塔頂的結果：一筆候選（伺服器取最佳） */
export function runEntries(run: { mode: Mode; score: number; timeMs: number }, now: number): BestEntry[] {
  return [{ mode: run.mode, score: run.score, timeMs: run.timeMs, achievedAt: now }];
}

/**
 * 寫不進瀏覽器（空間滿了、不能儲存）時，這一局的候選先放在記憶體，同步時一起收走（P 組）。
 * 重新整理就沒了，但這一頁還能送出去、登出前的「有沒有沒存到帳號的」檢查也看得到。
 */
let memoryInbox: BestEntry[] = [];
const MEMORY_KEY = "memory:";

export function addToInbox(store: Store | null, entries: BestEntry[], id: string) {
  try {
    if (!store) throw new Error("no store");
    store.setItem(`${INBOX_PREFIX}${id}`, JSON.stringify(entries));
  } catch {
    memoryInbox.push(...entries);
  }
}

export function readInbox(store: Store | null): { batch: BestEntry[]; keys: string[] } {
  const keys: string[] = [];
  const all: BestEntry[] = [];
  // 記憶體裡的候選：key 記下這次收了幾筆，收走時只移除這幾筆（收的期間新增的留著）
  if (memoryInbox.length > 0) {
    all.push(...memoryInbox);
    keys.push(`${MEMORY_KEY}${memoryInbox.length}`);
  }
  if (!store) return { batch: dedupeBests(all), keys };
  try {
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (!key?.startsWith(INBOX_PREFIX)) continue;
      keys.push(key);
      try {
        const data = JSON.parse(store.getItem(key) ?? "null") as unknown;
        if (Array.isArray(data)) all.push(...data.filter(isEntry));
      } catch {
        // 壞掉的 inbox 項目收走時一起刪掉
      }
    }
  } catch {
    return { batch: all, keys };
  }
  return { batch: dedupeBests(all), keys };
}

export function removeInbox(store: Store | null, keys: string[]) {
  for (const key of keys) {
    if (key.startsWith(MEMORY_KEY)) {
      memoryInbox = memoryInbox.slice(Number(key.slice(MEMORY_KEY.length)) || 0);
      continue;
    }
    try {
      store?.removeItem(key);
    } catch {
      // 刪不掉下次收到同一份，取高分不會重複
    }
  }
}
