import { deleteCookie, getCookie, getRequestURL, setCookie, setResponseHeader, setResponseStatus, type H3Event } from "h3";
import { UnauthorizedError } from "@/lib/account/player";
import { SESSION_COOKIE } from "@/lib/account/session";
import { FLAGS } from "@/lib/flags";

/** 本站的 https 一律加 Secure；本機 http://localhost 開發時不加，否則某些瀏覽器不存 cookie */
export const isSecure = (event: H3Event) => getRequestURL(event).protocol === "https:";

export const sessionToken = (event: H3Event) => getCookie(event, SESSION_COOKIE);

export function setSessionCookie(event: H3Event, token: string, expiresAt: Date) {
  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isSecure(event),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(event: H3Event) {
  deleteCookie(event, SESSION_COOKIE, { httpOnly: true, secure: isSecure(event), sameSite: "lax", path: "/" });
}

/**
 * 會改資料的 API 一律檢查 Origin 是本站，防跨站請求（CSRF）。
 * 瀏覽器送出 POST、PATCH、DELETE 時都會帶 Origin。
 */
export function sameOrigin(event: H3Event): boolean {
  const origin = event.headers.get("origin");
  return origin !== null && origin === getRequestURL(event).origin;
}

/** 錯誤回應：{ error, ...extra }，不快取 */
export function jsonError(event: H3Event, status: number, error: string, extra?: Record<string, unknown>) {
  setResponseStatus(event, status);
  setResponseHeader(event, "Cache-Control", "no-store");
  return { error, ...extra };
}

/** 成功的 JSON 回應，不快取 */
export function noStore<T>(event: H3Event, body: T): T {
  setResponseHeader(event, "Cache-Control", "no-store");
  return body;
}

/**
 * 帳號 API 的共用外殼：擋跨站請求、把 UnauthorizedError 轉成 401、其他錯誤轉成 500。
 * 回應的格式和狀態碼與原本的 Next.js 版本相同。
 */
export async function guarded<T>(
  event: H3Event,
  handler: () => Promise<T>,
  { checkOrigin = true } = {},
): Promise<T | { error: string }> {
  // 登入功能關閉時（正式站目前如此），帳號 API 一律當作不存在
  if (!FLAGS.login) return jsonError(event, 404, "not_found");
  if (checkOrigin && !sameOrigin(event)) return jsonError(event, 403, "origin");
  try {
    return await handler();
  } catch (error) {
    if (error instanceof UnauthorizedError) return jsonError(event, 401, "unauthorized");
    console.error(error);
    return jsonError(event, 500, "server");
  }
}
