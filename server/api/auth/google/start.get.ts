import { getQuery, getRequestURL, sendRedirect, setCookie, setResponseHeader } from "h3";
import { googleConfigured, OAUTH_COOKIE, OAUTH_COOKIE_MAX_AGE, startGoogleLogin } from "@/lib/account/google";
import { safeReturnPath, withLoginResult } from "@/lib/account/return-path";

/** 「用 Google 登入」：記下 state、PKCE 和要回去的頁面，導向 Google */
export default defineEventHandler((event) =>
  guarded(
    event,
    async () => {
      const url = getRequestURL(event);
      const query = getQuery(event).return;
      const returnPath = safeReturnPath(typeof query === "string" ? query : null);
      setResponseHeader(event, "Cache-Control", "no-store");
      if (!googleConfigured()) {
        console.error("GOOGLE_CLIENT_ID／GOOGLE_CLIENT_SECRET 沒有設定");
        return sendRedirect(event, new URL(withLoginResult(returnPath, "error"), url).toString(), 307);
      }
      const { url: google, state, verifier } = startGoogleLogin(url.origin);
      setCookie(event, OAUTH_COOKIE, JSON.stringify({ state, verifier, returnPath }), {
        httpOnly: true,
        secure: isSecure(event),
        sameSite: "lax",
        path: "/api/auth/google",
        maxAge: OAUTH_COOKIE_MAX_AGE,
      });
      return sendRedirect(event, google.toString(), 307);
    },
    // 一般的連結點擊，不帶 Origin
    { checkOrigin: false },
  ),
);
