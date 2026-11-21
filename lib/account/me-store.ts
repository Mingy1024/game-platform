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
/**
 * 狀態每換一次就加一。重新讀取（refreshMe）回來時如果這段期間狀態已經換過
 * （例如登出、刪除帳號、改名成功），就丟掉讀到的結果，不讓晚到的舊資料蓋掉比較新的狀態。
 */
let version = 0;

function set(next: MeState) {
  version += 1;
  state = next;
  for (const listener of listeners) listener();
}

function fromResponse(body: MeResponse): MeState {
  return body.loggedIn
    ? { status: "loggedIn", nick: body.nick, nickNextAt: body.nickNextAt ? new Date(body.nickNextAt) : null }
    : { status: "loggedOut" };
}

/**
 * 向伺服器重新讀取登入狀態。回傳 true 表示目前的狀態已經是最新的
 * （讀取成功，或讀取期間狀態已經被更新的結果取代）；false 表示讀取失敗。
 * keepOnError：讀取失敗時保留目前的狀態（已經登入、只是想更新暱稱時，不要因為一次網路錯誤把整個帳號畫面換成錯誤）
 */
export async function refreshMe({ keepOnError = false } = {}): Promise<boolean> {
  if (!FLAGS.login) {
    set({ status: "loggedOut" });
    return true;
  }
  const startedAt = version;
  try {
    const response = await fetch("/api/me", { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) throw new Error(String(response.status));
    const body = (await response.json()) as MeResponse;
    if (version === startedAt) set(fromResponse(body));
    return true;
  } catch {
    if (version !== startedAt) return true;
    if (!keepOnError) set({ status: "error" });
    return false;
  }
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
  set({ status: "loggedOut" });
  return true;
}

export async function deleteAccount(): Promise<boolean> {
  const response = await fetch("/api/me", { method: "DELETE", credentials: "same-origin" }).catch(() => null);
  if (!response?.ok) return false;
  set({ status: "loggedOut" });
  return true;
}

/**
 * stale：伺服器回了 conflict 或 too_soon（暱稱可能在別的地方改過了），但重新讀取最新狀態失敗；
 * cause 是原本的錯誤，重新讀取成功後畫面改顯示它
 */
export type NickResult =
  | { ok: true }
  | { ok: false; error: NickError | "network"; nickNextAt?: Date }
  | { ok: false; error: "stale"; cause: "conflict" | "too_soon"; nickNextAt?: Date };

/** 自訂暱稱；custom 是 null 時改回隨機名字 */
export async function saveNick(custom: string | null): Promise<NickResult> {
  const response = await fetch("/api/me/nick", {
    method: "PATCH",
    headers: JSON_HEADERS,
    credentials: "same-origin",
    body: JSON.stringify({ custom }),
  }).catch(() => null);
  if (!response) return { ok: false, error: "network" };
  const body = (await response.json().catch(() => ({}))) as MeResponse & { error?: NickError; nickNextAt?: string };
  if (response.ok) {
    set(fromResponse(body));
    return { ok: true };
  }
  if (response.status === 401) set({ status: "loggedOut" });
  const nickNextAt = body.nickNextAt ? new Date(body.nickNextAt) : undefined;
  // 帳號剛在別的分頁改過（conflict），或冷卻中（too_soon，可能也是別的分頁剛改名）：
  // 等重新讀取完成，畫面才換成最新的暱稱和下次可以改的時間
  if (body.error === "conflict" || body.error === "too_soon") {
    if (!(await refreshMe({ keepOnError: true }))) {
      // 讀取失敗時至少同步冷卻時間，表單跟著停用；畫面提供重新讀取
      if (nickNextAt && state.status === "loggedIn") set({ ...state, nickNextAt });
      return { ok: false, error: "stale", cause: body.error, nickNextAt };
    }
  }
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
