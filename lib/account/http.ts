import { NextResponse, type NextRequest } from "next/server";
import { FLAGS } from "@/lib/flags";
import { UnauthorizedError } from "./player";
import { SESSION_COOKIE } from "./session";

/** 本站的 https 一律加 Secure；本機 http://localhost 開發時不加，否則某些瀏覽器不存 cookie */
export function isSecure(request: NextRequest): boolean {
  return request.nextUrl.protocol === "https:";
}

export function setSessionCookie(response: NextResponse, request: NextRequest, token: string, expiresAt: Date) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isSecure(request),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(response: NextResponse, request: NextRequest) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: isSecure(request),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * 會改資料的 API 一律檢查 Origin 是本站，防跨站請求（CSRF）。
 * 瀏覽器送出 POST、PATCH、DELETE 時都會帶 Origin。
 */
export function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === request.nextUrl.origin;
}

export function jsonError(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status, headers: { "Cache-Control": "no-store" } });
}

/** route handler 的共用外殼：擋跨站請求、把 UnauthorizedError 轉成 401、其他錯誤轉成 500 */
export async function guarded(
  request: NextRequest,
  handler: () => Promise<NextResponse>,
  { checkOrigin = true } = {},
): Promise<NextResponse> {
  // 登入功能關閉時（正式站目前如此），帳號 API 一律當作不存在
  if (!FLAGS.login) return jsonError(404, "not_found");
  if (checkOrigin && !sameOrigin(request)) return jsonError(403, "origin");
  try {
    return await handler();
  } catch (error) {
    if (error instanceof UnauthorizedError) return jsonError(401, "unauthorized");
    console.error(error);
    return jsonError(500, "server");
  }
}
