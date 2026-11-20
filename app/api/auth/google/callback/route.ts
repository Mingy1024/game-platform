import { NextResponse, type NextRequest } from "next/server";
import { finishGoogleLogin, OAUTH_COOKIE } from "@/lib/account/google";
import { guarded, isSecure, setSessionCookie } from "@/lib/account/http";
import { findOrCreateGooglePlayer } from "@/lib/account/player";
import { safeReturnPath, withLoginResult } from "@/lib/account/return-path";
import { createSession } from "@/lib/account/session";
import { getDb } from "@/lib/db";

type OAuthCookie = { state: string; verifier: string; returnPath: string };

function readOAuthCookie(raw: string | undefined): OAuthCookie | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<OAuthCookie>;
    if (typeof value.state === "string" && typeof value.verifier === "string") {
      return { state: value.state, verifier: value.verifier, returnPath: safeReturnPath(value.returnPath) };
    }
  } catch {}
  return null;
}

/** Google 導回來：比對 state、換 token、找或建玩家、建 session，回到原本的頁面 */
export function GET(request: NextRequest) {
  return guarded(
    request,
    async () => {
      const saved = readOAuthCookie(request.cookies.get(OAUTH_COOKIE)?.value);
      const code = request.nextUrl.searchParams.get("code");
      const state = request.nextUrl.searchParams.get("state");
      const returnPath = saved?.returnPath ?? "/";

      const finish = (result: "ok" | "error") => {
        const response = NextResponse.redirect(new URL(withLoginResult(returnPath, result), request.url));
        response.cookies.set(OAUTH_COOKIE, "", {
          httpOnly: true,
          secure: isSecure(request),
          sameSite: "lax",
          path: "/api/auth/google",
          maxAge: 0,
        });
        response.headers.set("Cache-Control", "no-store");
        return response;
      };

      // 取消授權（?error=access_denied）、cookie 過期、state 不符，都算登入沒有完成
      if (!saved || !code || !state || state !== saved.state) return finish("error");

      let googleSub: string;
      try {
        googleSub = await finishGoogleLogin(request.nextUrl.origin, code, saved.verifier);
      } catch (error) {
        console.error("Google 登入失敗", error);
        return finish("error");
      }

      const player = await findOrCreateGooglePlayer(googleSub);
      const { token, expiresAt } = await createSession(getDb(), player.id);
      const response = finish("ok");
      setSessionCookie(response, request, token, expiresAt);
      return response;
    },
    // 從 Google 導回來是一般的頁面跳轉，不帶本站的 Origin；改用 state 防偽造
    { checkOrigin: false },
  );
}
