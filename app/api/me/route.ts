import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookie, guarded, jsonError, setSessionCookie } from "@/lib/account/http";
import { meResponse } from "@/lib/account/player";
import { SESSION_COOKIE, validateSession } from "@/lib/account/session";
import { getDb } from "@/lib/db";

const NO_STORE = { "Cache-Control": "no-store" };

/** 前端取登入狀態。session 快到期時順便延長 cookie。 */
export function GET(request: NextRequest) {
  return guarded(
    request,
    async () => {
      const token = request.cookies.get(SESSION_COOKIE)?.value;
      const result = token ? await validateSession(getDb(), token) : null;
      const response = NextResponse.json(meResponse(result?.player ?? null), { headers: NO_STORE });
      if (token && !result) clearSessionCookie(response, request);
      if (token && result?.renewedExpiresAt) setSessionCookie(response, request, token, result.renewedExpiresAt);
      return response;
    },
    { checkOrigin: false },
  );
}

/**
 * 刪除帳號：刪掉玩家、他所有的 session（資料表設了 ON DELETE CASCADE），
 * 之後各遊戲的紀錄表也用 CASCADE 一起刪。
 */
export function DELETE(request: NextRequest) {
  return guarded(request, async () => {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const db = getDb();
    const result = token ? await validateSession(db, token) : null;
    if (!result) return jsonError(401, "unauthorized");
    await db.player.delete({ where: { id: result.player.id } });
    const response = NextResponse.json({ ok: true }, { headers: NO_STORE });
    clearSessionCookie(response, request);
    return response;
  });
}
