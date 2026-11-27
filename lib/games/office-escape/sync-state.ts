import { dedupeBests, isAcceptable, type BestEntry } from "./account-records";

/**
 * 還沒存到帳號的最佳紀錄（待上傳）。伺服器只取高分，所以不需要批次代碼、不需要追蹤「送出去的是哪一批」：
 * 重送同樣的紀錄一定是冪等的（docs/plans/archive/office-escape.md 的檢查表）。
 *
 * 共用狀態與寫入者（docs/dev/sync-checklist.md 第 1 節）：
 * - pending（PENDING_KEY）：只在同步的 Web Lock 裡「讀→改→寫」（收 inbox、送出成功後移除已確認的、登出清空）。
 *   內容：guestSyncId（建立訪客時用，同一個代碼找回同一個訪客）＋ bests（每種、每天只留最高分）。
 * - inbox（INBOX_PREFIX＋隨機代碼）：玩完一局時新增一個新 key，不改共用 key；由鎖裡的同步收走並刪除。
 *   玩完一局的當下不在鎖裡，所以只能新增、不能改 pending。
 */
export const PENDING_KEY = "game-station:office-escape:pending:v1";
export const INBOX_PREFIX = "game-station:office-escape:run:";

export type PendingState = { guestSyncId: string; bests: BestEntry[] };
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

const isEntry = (value: unknown): value is BestEntry => {
  const e = value as Partial<BestEntry> | null;
  return (
    !!e &&
    (e.mode === "daily" || e.mode === "all") &&
    (e.mode === "all" ? e.dateKey === null : typeof e.dateKey === "string") &&
    typeof e.score === "number" &&
    Number.isInteger(e.score) &&
    e.score >= 0 &&
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
  try {
    store?.removeItem(PENDING_KEY);
  } catch {
    // 不能儲存就算了
  }
}

export const forgetPendingMemory = () => {
  memory = null;
};

/** 過期的（超過 14 天、日期不存在）濾掉，不拿去送、也不佔空間 */
export function prune(state: PendingState, now: number): PendingState {
  const bests = state.bests.filter((entry) => isAcceptable(entry, now));
  return bests.length === state.bests.length ? state : { ...state, bests };
}

export function withBests(state: PendingState, incoming: BestEntry[]): PendingState {
  if (incoming.length === 0) return state;
  return { ...state, bests: dedupeBests([...state.bests, ...incoming]) };
}

const keyOf = (e: BestEntry) => `${e.mode}:${e.dateKey ?? ""}`;

/** 送出成功後，移除伺服器已經確認的：同一種、同一天、分數不高於送出的那筆。送出期間新增的更高分留著 */
export function removeConfirmed(state: PendingState, sent: BestEntry[]): PendingState {
  const sentScore = new Map(sent.map((e) => [keyOf(e), e.score]));
  return { ...state, bests: state.bests.filter((e) => (sentScore.get(keyOf(e)) ?? -1) < e.score) };
}

/** 一局的結果：今天的最佳和歷史最佳兩筆候選（伺服器取高分） */
export function runEntries(run: { dateKey: string; total: number }, now: number): BestEntry[] {
  return [
    { mode: "daily", dateKey: run.dateKey, score: run.total, achievedAt: now },
    { mode: "all", dateKey: null, score: run.total, achievedAt: now },
  ];
}

export function addToInbox(store: Store | null, entries: BestEntry[], id: string) {
  try {
    store?.setItem(`${INBOX_PREFIX}${id}`, JSON.stringify(entries));
  } catch {
    // 寫不進去就只剩本機最佳（records.ts），下一局還是會有新的候選
  }
}

export function readInbox(store: Store | null): { batch: BestEntry[]; keys: string[] } {
  const keys: string[] = [];
  const all: BestEntry[] = [];
  if (!store) return { batch: all, keys };
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
    try {
      store?.removeItem(key);
    } catch {
      // 刪不掉下次收到同一份，取高分不會重複
    }
  }
}
