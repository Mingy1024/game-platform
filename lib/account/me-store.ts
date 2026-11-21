import { FLAGS } from "@/lib/flags";
import type { Nick } from "./nick/nick";
import type { NickError } from "./nick/rules";
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

function set(next: MeState) {
  state = next;
  for (const listener of listeners) listener();
}

function fromResponse(body: MeResponse): MeState {
  return body.loggedIn
    ? { status: "loggedIn", nick: body.nick, nickNextAt: body.nickNextAt ? new Date(body.nickNextAt) : null }
    : { status: "loggedOut" };
}

export async function refreshMe(): Promise<void> {
  if (!FLAGS.login) return set({ status: "loggedOut" });
  try {
    const response = await fetch("/api/me", { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) throw new Error(String(response.status));
    set(fromResponse((await response.json()) as MeResponse));
  } catch {
    set({ status: "error" });
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

export type NickResult = { ok: true } | { ok: false; error: NickError | "network"; nickNextAt?: Date };

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
  return {
    ok: false,
    error: body.error ?? "network",
    nickNextAt: body.nickNextAt ? new Date(body.nickNextAt) : undefined,
  };
}

/** 登入網址：登入後回到 returnPath（預設目前這一頁） */
export function loginHref(returnPath: string): string {
  return `/api/auth/google/start?return=${encodeURIComponent(returnPath)}`;
}
