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
 * 規則只有兩條，所有請求都照這兩條判斷要不要採用回應：
 *
 * 1. 登入期（session）：登出、刪除帳號、收到 401 時加一。舊的登入期發出的請求，回來後一律丟掉，
 *    不會把已經登出的畫面改回登入。
 * 2. 讀取序號（refreshTicket）：只有最新的一次讀取能寫入狀態。比較舊的讀取回來時，
 *    改成等最新那一次的結果（latestRefresh），自己不判斷成功或失敗。
 *    改名成功時直接採用伺服器回應，並讓還在路上的讀取全部作廢（它們讀到的可能是改名前的資料）。
 */
let session = 0;
let refreshTicket = 0;

/**
 * applied：讀到的資料已經寫入，狀態是最新的
 * ended：讀取期間登出或刪除了帳號，結果丟掉
 * failed：讀取失敗，狀態沒有更新
 */
export type RefreshResult = "applied" | "ended" | "failed";
let latestRefresh: Promise<RefreshResult> = Promise.resolve("applied");

function set(next: MeState) {
  state = next;
  for (const listener of listeners) listener();
}

/** 登出、刪除帳號、收到 401：進入新的登入期，還在路上的請求回來後都不採用 */
function endSession() {
  session += 1;
  refreshTicket += 1;
  latestRefresh = Promise.resolve("ended");
  set({ status: "loggedOut" });
}

/** 採用伺服器回的最新狀態（改名成功），還在路上的讀取全部作廢 */
function applyAuthoritative(next: MeState) {
  refreshTicket += 1;
  latestRefresh = Promise.resolve("applied");
  set(next);
}

function fromResponse(body: MeResponse): MeState {
  return body.loggedIn
    ? { status: "loggedIn", nick: body.nick, nickNextAt: body.nickNextAt ? new Date(body.nickNextAt) : null }
    : { status: "loggedOut" };
}

/**
 * 向伺服器重新讀取登入狀態（規則見上面）。
 * keepOnError：讀取失敗時保留目前的狀態（已經登入、只是想更新暱稱時，不要因為一次網路錯誤把整個帳號畫面換成錯誤）
 */
export function refreshMe({ keepOnError = false } = {}): Promise<RefreshResult> {
  if (!FLAGS.login) {
    set({ status: "loggedOut" });
    return Promise.resolve("applied");
  }
  const ticket = ++refreshTicket;
  const sessionAt = session;
  const run = async (): Promise<RefreshResult> => {
    const next = await fetch("/api/me", { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => (response.ok ? fromResponse((await response.json()) as MeResponse) : null))
      .catch(() => null);
    if (session !== sessionAt) return "ended";
    // 這段期間有比較新的讀取或改名：以它為準
    if (ticket !== refreshTicket) return latestRefresh;
    if (next) {
      set(next);
      return "applied";
    }
    if (!keepOnError) set({ status: "error" });
    return "failed";
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

/** 第一次用到時才向伺服器要資料 */
export function ensureMe(): void {
  if (started) return;
  started = true;
  void refreshMe();
}

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function logout(): Promise<boolean> {
  const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => null);
  if (!response?.ok) return false;
  endSession();
  return true;
}

export async function deleteAccount(): Promise<boolean> {
  const response = await fetch("/api/me", { method: "DELETE", credentials: "same-origin" }).catch(() => null);
  if (!response?.ok) return false;
  endSession();
  return true;
}

/**
 * 改暱稱的結果。
 * - synced：已經重新讀取到最新狀態，表單要把輸入框換成目前的暱稱（會清掉沒存成的草稿）
 * - stale：伺服器說暱稱可能在別的地方改過了（conflict／too_soon），但讀不到最新狀態；畫面提供重新讀取（resyncNick）
 * - nickNextAt：下次可以改的時間；重新讀取成功時以讀到的為準
 */
export type NickResult =
  | { ok: true }
  | { ok: false; error: NickError | "network" | "stale"; nickNextAt?: Date; synced?: true };

/**
 * 重新讀取帳號狀態，給暱稱表單用：saveNick 收到 conflict／too_soon 後、按「重新讀取」時。
 * 讀取成功時依最新狀態決定提示：還在冷卻中是 too_soon（附最新的日期），否則是 conflict（請再確認一次）。
 * fallbackNext：伺服器先前給的冷卻時間，讀取失敗時至少先寫進狀態，表單跟著停用。
 */
export async function resyncNick(fallbackNext?: Date): Promise<NickResult> {
  const result = await refreshMe({ keepOnError: true });
  if (result === "applied" && state.status === "loggedIn") {
    const next = state.nickNextAt;
    return next ? { ok: false, error: "too_soon", nickNextAt: next, synced: true } : { ok: false, error: "conflict", synced: true };
  }
  // 已經登出（表單會跟著消失）
  if (result !== "failed" || state.status !== "loggedIn") return { ok: false, error: "network" };
  if (fallbackNext) set({ ...state, nickNextAt: fallbackNext });
  return { ok: false, error: "stale", nickNextAt: fallbackNext };
}

/** 自訂暱稱；custom 是 null 時改回隨機名字 */
export async function saveNick(custom: string | null): Promise<NickResult> {
  const sessionAt = session;
  const response = await fetch("/api/me/nick", {
    method: "PATCH",
    headers: JSON_HEADERS,
    credentials: "same-origin",
    body: JSON.stringify({ custom }),
  }).catch(() => null);
  if (!response) return { ok: false, error: "network" };
  const body = (await response.json().catch(() => ({}))) as MeResponse & { error?: NickError; nickNextAt?: string };
  // 送出之後登出或刪除了帳號：回應不採用（表單已經消失）
  if (session !== sessionAt) return { ok: false, error: "network" };
  if (response.ok) {
    applyAuthoritative(fromResponse(body));
    return { ok: true };
  }
  if (response.status === 401) {
    endSession();
    return { ok: false, error: "network" };
  }
  const nickNextAt = body.nickNextAt ? new Date(body.nickNextAt) : undefined;
  // 帳號剛在別的分頁改過（conflict），或冷卻中（too_soon，可能也是別的分頁剛改名）：重新讀取後再決定提示
  if (body.error === "conflict" || body.error === "too_soon") return resyncNick(nickNextAt);
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
