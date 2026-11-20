import { NextResponse, type NextRequest } from "next/server";
import { googleConfigured, OAUTH_COOKIE, OAUTH_COOKIE_MAX_AGE, startGoogleLogin } from "@/lib/account/google";
import { guarded, isSecure } from "@/lib/account/http";
import { safeReturnPath, withLoginResult } from "@/lib/account/return-path";

/** 「用 Google 登入」：記下 state、PKCE 和要回去的頁面，導向 Google */
export function GET(request: NextRequest) {
  return guarded(
    request,
    async () => {
      const returnPath = safeReturnPath(request.nextUrl.searchParams.get("return"));
      if (!googleConfigured()) {
        console.error("GOOGLE_CLIENT_ID／GOOGLE_CLIENT_SECRET 沒有設定");
        return NextResponse.redirect(new URL(withLoginResult(returnPath, "error"), request.url));
      }
      const { url, state, verifier } = startGoogleLogin(request.nextUrl.origin);
      const response = NextResponse.redirect(url);
      response.cookies.set(OAUTH_COOKIE, JSON.stringify({ state, verifier, returnPath }), {
        httpOnly: true,
        secure: isSecure(request),
        sameSite: "lax",
        path: "/api/auth/google",
        maxAge: OAUTH_COOKIE_MAX_AGE,
      });
      response.headers.set("Cache-Control", "no-store");
      return response;
    },
    // 一般的連結點擊，不帶 Origin
    { checkOrigin: false },
  );
}
