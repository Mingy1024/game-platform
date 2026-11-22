import { deleteCookie, getCookie, getRequestHeader, setCookie, type H3Event } from "h3";
import type { PrismaClient } from "@/generated/prisma/client";
import { consentRequiredFor } from "@/lib/account/consent-region";
import { GUEST_COOKIE, validateGuest } from "@/lib/account/guest";
import { mergeGuest } from "@/lib/account/guest-merge";
import type { Player } from "@/lib/account/player";
import { SESSION_COOKIE, validateSession } from "@/lib/account/session";

/**
 * 伺服器端的身分：Google 登入（gs_session）、訪客（gs_guest）或都沒有（精準停車設計稿第 14.2 節）。
 * 同時帶著兩種 cookie 時以 Google 為準，訪客先併進帳號（mergeGuest）。
 */
export type Identity = { kind: "google"; player: Player } | { kind: "guest"; player: Player } | { kind: "none" };

export function setGuestCookie(event: H3Event, token: string, expiresAt: Date) {
  setCookie(event, GUEST_COOKIE, token, { httpOnly: true, secure: isSecure(event), sameSite: "lax", path: "/", expires: expiresAt });
}

export function clearGuestCookie(event: H3Event) {
  deleteCookie(event, GUEST_COOKIE, { httpOnly: true, secure: isSecure(event), sameSite: "lax", path: "/" });
}

/** gs_session 對到的 Google 玩家；無效時清掉 cookie。訪客的 token 放在 gs_session 也不認 */
export async function googlePlayer(event: H3Event, db: PrismaClient): Promise<Player | null> {
  const token = getCookie(event, SESSION_COOKIE);
  if (!token) return null;
  const result = await validateSession(db, token);
  if (!result || result.player.kind !== "google") {
    clearSessionCookie(event);
    return null;
  }
  if (result.renewedExpiresAt) setSessionCookie(event, token, result.renewedExpiresAt);
  return result.player;
}

/** gs_guest 對到的訪客；無效（被刪除、90 天被清掉）時清掉 cookie，當作沒有身分（T16） */
export async function guestPlayer(event: H3Event, db: PrismaClient): Promise<Player | null> {
  const token = getCookie(event, GUEST_COOKIE);
  if (!token) return null;
  const result = await validateGuest(db, token);
  if (!result) {
    clearGuestCookie(event);
    return null;
  }
  if (result.renewedExpiresAt) setGuestCookie(event, token, result.renewedExpiresAt);
  return result.player;
}

/**
 * 已經用 Google 登入、又帶著訪客 cookie：先把訪客併進帳號、清掉 gs_guest。
 * 回傳 false 表示併的時候失敗（cookie 留著，下次讀 /api/me 再併）。
 */
export async function absorbGuest(event: H3Event, db: PrismaClient, accountId: string): Promise<boolean> {
  if (!getCookie(event, GUEST_COOKIE)) return true;
  try {
    const guest = await guestPlayer(event, db);
    if (guest) await mergeGuest(useD1(event), guest.id, accountId);
    clearGuestCookie(event);
    return true;
  } catch (error) {
    console.error("訪客併進帳號失敗", error);
    return false;
  }
}

/** 目前的身分（不併訪客；需要時呼叫的地方自己 absorbGuest） */
export async function resolveIdentity(event: H3Event, db: PrismaClient): Promise<Identity> {
  const google = await googlePlayer(event, db);
  if (google) return { kind: "google", player: google };
  const guest = await guestPlayer(event, db);
  return guest ? { kind: "guest", player: guest } : { kind: "none" };
}

/**
 * Cloudflare 判斷的國家代碼。開發環境（nuxt dev）讀不到真的，改看 cf-ipcountry 標頭，E2E 用它模擬歐盟地區；
 * 正式環境只看 request.cf（使用者改不了）。
 */
function requestCountry(event: H3Event): string | null {
  if (import.meta.dev) return getRequestHeader(event, "cf-ipcountry") ?? null;
  const cf = (event.context.cloudflare?.request as { cf?: { country?: string } } | undefined)?.cf;
  return cf?.country ?? null;
}

/** 這個地區建立訪客前要先問同意嗎（第 37 題，T11） */
export const consentRequired = (event: H3Event) => consentRequiredFor(requestCountry(event));

/** 建立訪客的限流 key：連線的 IP（Cloudflare 填的 cf-connecting-ip，使用者改不了） */
export const clientIp = (event: H3Event) => getRequestHeader(event, "cf-connecting-ip") ?? "unknown";
