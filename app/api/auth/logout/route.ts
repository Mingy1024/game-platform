import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookie, guarded } from "@/lib/account/http";
import { deleteSession, SESSION_COOKIE } from "@/lib/account/session";
import { getDb } from "@/lib/db";

/** 登出：刪掉這個 session 和 cookie */
export function POST(request: NextRequest) {
  return guarded(request, async () => {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (token) await deleteSession(getDb(), token);
    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    clearSessionCookie(response, request);
    return response;
  });
}
