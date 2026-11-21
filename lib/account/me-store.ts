import { FLAGS } from "@/lib/flags";
import type { Nick } from "./nick/nick";
import { NICK_ERRORS, type NickError } from "./nick/rules";
import type { MeResponse } from "./player";

/**
 * 前端的登入狀態：各頁共用同一份，登入、登出、改暱稱後即時更新。
 * 第一次有元件用到時才向 /api/me 要資料（ensureMe）；登入功能關閉時一律是「未登入」，不發請求。
 * 純邏輯，只在瀏覽器端呼叫；畫面層用 app/composables/useMe.ts 訂閱。
 */
export type MeState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "loggedOut" }
  | { status: "loggedIn"; nick: Nick; nickNextAt: Date | null };

let state: MeState = { status: "loading" };
let started = false;
const listeners = new Set<() => void>();

/*
 * 好幾種請求會改這份狀態（讀取帳號、改名、登出、刪除帳號），回應的順序不一定和送出的順序一樣。
 * 所有請求都照下面三條規則判斷要不要採用回應：
 *
 * 1. 登入期（session）：登出、刪除帳號、收到 401、讀取到「未登入」時加一。
 *    舊的登入期發出的請求，回來後一律丟掉，不會把已經登出的畫面改回登入。
 * 2. 讀取序號（refreshTicket）：只有最新的一次讀取能寫入狀態。比較舊的讀取回來時，
 *    改成等最新那一次的結果（latestRefresh），自己不判斷成功或失敗。
 *    改名成功時直接採用伺服器回應，並讓還在路上的讀取全部作廢（它們讀到的可能是改名前的資料）。
 * 3. 改名排隊（nickQueue）：改名和衝突後的重新讀取一次只做一件，前一件的回應回來才送下一件。
 *    前端送出的順序不代表伺服器寫入的順序，同時送出兩次改名時，晚到的舊回應會讓暱稱倒退。
 *
 * 已知限制：別的分頁同時改名時，仍要靠伺服器回的 409 發現，再重新讀取；
 * 要完全照伺服器寫入順序判斷新舊，得在回應裡加上伺服器的版本號（目前沒有）。
 */
let session = 0;
let refreshTicket = 0;

/** 每個請求的等待上限：網路卡住時不會讓畫面或等待中的讀取一直等下去 */
const REQUEST_TIMEOUT_MS = 15_000;
const withTimeout = (init: RequestInit = {}): RequestInit => ({ ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });

/**
 * applied：讀到的資料已經寫入，狀態是最新的
 * committed：讀取期間本頁改名成功，狀態是改名的結果（讀到的資料丟掉）
 * ended：已經登出（讀取期間登出、刪除帳號，或讀到的就是未登入）
 * failed：讀取失敗，狀態沒有更新
 */
export type RefreshResult = "applied" | "committed" | "ended" | "failed";
let latestRefresh: Promise<RefreshResult> = Promise.resolve("applied");

function set(next: MeState) {
  state = next;
  for (const listener of listeners) listener();
}

/** 登入期結束：還在路上的請求回來後都不採用 */
function endSession() {
  session += 1;
  refreshTicket += 1;
  latestRefresh = Promise.resolve("ended");
  set({ status: "loggedOut" });
}

/** 採用伺服器回的最新狀態（改名成功），還在路上的讀取全部作廢 */
function commit(next: MeState) {
  if (next.status !== "loggedIn") return endSession();
  refreshTicket += 1;
  latestRefresh = Promise.resolve("committed");
  set(next);
}

function fromResponse(body: MeResponse): MeState {
  return body.loggedIn
    ? { status: "loggedIn", nick: body.nick, nickNextAt: body.nickNextAt ? new Date(body.nickNextAt) : null }
    : { status: "loggedOut" };
}

/**
 * 向伺服器重新讀取登入狀態（規則見上面）。
 * keepOnError：讀取失敗時保留目前的狀態（已經登入、只是想更新暱稱時，不要因為一次網路錯誤把整個帳號畫面換成錯誤）。
 * 還沒有任何資料（loading）時沒有東西可以保留，失敗一律變成 error，畫面不會一直停在載入中。
 */
export function refreshMe({ keepOnError = false } = {}): Promise<RefreshResult> {
  if (!FLAGS.login) {
    set({ status: "loggedOut" });
    return Promise.resolve("ended");
  }
  const ticket = ++refreshTicket;
  const sessionAt = session;
  const run = async (): Promise<RefreshResult> => {
    const next = await fetch("/api/me", withTimeout({ cache: "no-store", credentials: "same-origin" }))
      .then(async (response) => (response.ok ? fromResponse((await response.json()) as MeResponse) : null))
      .catch(() => null);
    if (session !== sessionAt) return "ended";
    // 這段期間有比較新的讀取或改名：以它為準
    if (ticket !== refreshTicket) return latestRefresh;
    if (!next) {
      if (!keepOnError || state.status === "loading") set({ status: "error" });
      return "failed";
    }
    if (next.status === "loggedOut") {
      // 伺服器說已經登出（例如在別的分頁登出）：和本頁登出一樣結束登入期
      if (state.status === "loggedIn") endSession();
      else set(next);
      return "ended";
    }
    set(next);
    return "applied";
  };
  const promise = run();
  latestRefresh = promise;
  return promise;
}

export function subscribeMe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 伺服器端與第一次畫面的狀態 */
export const SERVER_ME: MeState = { status: "loading" };

export const readMe = (): MeState => state;

/** 第一次用到時才向伺服器要資料；上次讀取失敗（error）時，下一個用到的元件會再讀一次 */
export function ensureMe(): void {
  if (started && state.status !== "error") return;
  started = true;
  void refreshMe();
}

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function logout(): Promise<boolean> {
  const response = await fetch("/api/auth/logout", withTimeout({ method: "POST", credentials: "same-origin" })).catch(() => null);
  if (!response?.ok) return false;
  endSession();
  return true;
}

export async function deleteAccount(): Promise<boolean> {
  const response = await fetch("/api/me", withTimeout({ method: "DELETE", credentials: "same-origin" })).catch(() => null);
  if (!response?.ok) return false;
  endSession();
  return true;
}

/**
 * 改暱稱的結果。
 * - ok：改名成功；quiet 表示不是這次動作改的（重新讀取期間本頁的改名已經成功），不顯示「改好了」
 * - synced：已經重新讀取到最新狀態，表單要把輸入框換成目前的暱稱（會清掉沒存成的草稿）
 * - stale：伺服器說暱稱可能在別的地方改過了（conflict／too_soon），但讀不到最新狀態；畫面提供重新讀取（resyncNick）
 * - nickNextAt：下次可以改的時間，和共用狀態裡採用的一致
 */
export type NickResult =
  | { ok: true; quiet?: true }
  | { ok: false; error: NickError | "network" | "stale"; nickNextAt?: Date; synced?: true };

/** 改名排隊：前一件做完（不論成功失敗）才開始下一件 */
let nickQueue: Promise<unknown> = Promise.resolve();
function enqueue(task: () => Promise<NickResult>): Promise<NickResult> {
  const result = nickQueue.then(task, task);
  nickQueue = result.catch(() => undefined);
  return result;
}

/** 依目前的共用狀態給冷卻提示：還在冷卻中是 too_soon（附日期），否則是 conflict（請再確認一次） */
function cooldownResult(): NickResult {
  const next = state.status === "loggedIn" ? state.nickNextAt : null;
  return next ? { ok: false, error: "too_soon", nickNextAt: next, synced: true } : { ok: false, error: "conflict", synced: true };
}

/**
 * 重新讀取帳號狀態，給暱稱表單用（conflict／too_soon 之後）。
 * fallbackNext：伺服器在 409 給的冷卻時間。讀取失敗時，只有它還沒過期、而且比目前狀態裡的晚，才寫進狀態，
 * 不會用過時的日期蓋掉比較新的，也不會用已經過期的日期把表單鎖住。
 */
async function resync(fallbackNext?: Date): Promise<NickResult> {
  const result = await refreshMe({ keepOnError: true });
  if (result === "applied") return cooldownResult();
  if (result === "committed") return { ok: true, quiet: true };
  // 已經登出（表單會跟著消失）
  if (result === "ended" || state.status !== "loggedIn") return { ok: false, error: "network" };
  const current = state.nickNextAt;
  if (fallbackNext && fallbackNext.getTime() > Date.now() && (!current || fallbackNext > current)) {
    set({ ...state, nickNextAt: fallbackNext });
  }
  return { ok: false, error: "stale", nickNextAt: state.nickNextAt ?? undefined };
}

/** 「重新讀取」按鈕：和改名排在同一個隊伍裡 */
export const resyncNick = (fallbackNext?: Date) => enqueue(() => resync(fallbackNext));

/** 自訂暱稱；custom 是 null 時改回隨機名字 */
export const saveNick = (custom: string | null) => enqueue(() => sendNick(custom));

async function sendNick(custom: string | null): Promise<NickResult> {
  const sessionAt = session;
  const response = await fetch(
    "/api/me/nick",
    withTimeout({ method: "PATCH", headers: JSON_HEADERS, credentials: "same-origin", body: JSON.stringify({ custom }) }),
  ).catch(() => null);
  if (!response) return { ok: false, error: "network" };
  const body = (await response.json().catch(() => ({}))) as MeResponse & { error?: NickError; nickNextAt?: string };
  // 送出之後登出或刪除了帳號：回應不採用（表單已經消失）
  if (session !== sessionAt) return { ok: false, error: "network" };
  if (response.ok) {
    commit(fromResponse(body));
    return { ok: true };
  }
  if (response.status === 401) {
    endSession();
    return { ok: false, error: "network" };
  }
  const nickNextAt = body.nickNextAt ? new Date(body.nickNextAt) : undefined;
  // 帳號剛在別的分頁改過（conflict），或冷卻中（too_soon，可能也是別的分頁剛改名）：重新讀取後再決定提示
  if (body.error === "conflict" || body.error === "too_soon") return resync(nickNextAt);
  return {
    ok: false,
    // 伺服器暫時無法處理（503 unavailable）或不認得的錯誤，畫面上都顯示「等一下再試一次」
    error: body.error && NICK_ERRORS.has(body.error) ? body.error : "network",
    nickNextAt,
  };
}

/** 登入網址：登入後回到 returnPath（預設目前這一頁） */
export function loginHref(returnPath: string): string {
  return `/api/auth/google/start?return=${encodeURIComponent(returnPath)}`;
}
