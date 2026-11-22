import { deleteCookie, getCookie, getQuery, getRequestURL, sendRedirect, setResponseHeader } from "h3";
import { finishGoogleLogin, OAUTH_COOKIE } from "@/lib/account/google";
import { findOrCreateGooglePlayer } from "@/lib/account/player";
import { safeReturnPath, withLoginResult } from "@/lib/account/return-path";
import { createSession } from "@/lib/account/session";
import { FLAGS } from "@/lib/flags";

type OAuthCookie = { state: string; verifier: string; returnPath: string };

function readOAuthCookie(raw: string | undefined): OAuthCookie | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<OAuthCookie>;
    if (typeof value.state === "string" && typeof value.verifier === "string") {
      return { state: value.state, verifier: value.verifier, returnPath: safeReturnPath(value.returnPath) };
    }
  } catch {
    // 格式不對當作沒有 cookie
  }
  return null;
}

/** Google 導回來：比對 state、換 token、找或建玩家、建 session，回到原本的頁面 */
export default defineEventHandler((event) =>
  guarded(
    event,
    async () => {
      const url = getRequestURL(event);
      const query = getQuery(event);
      const saved = readOAuthCookie(getCookie(event, OAUTH_COOKIE));
      const code = typeof query.code === "string" ? query.code : null;
      const state = typeof query.state === "string" ? query.state : null;
      const returnPath = saved?.returnPath ?? "/";

      const finish = (result: "ok" | "error") => {
        deleteCookie(event, OAUTH_COOKIE, { httpOnly: true, secure: isSecure(event), sameSite: "lax", path: "/api/auth/google" });
        setResponseHeader(event, "Cache-Control", "no-store");
        return sendRedirect(event, new URL(withLoginResult(returnPath, result), url).toString(), 307);
      };

      // 取消授權（?error=access_denied）、cookie 過期、state 不符，都算登入沒有完成
      if (!saved || !code || !state || state !== saved.state) return finish("error");

      let googleSub: string;
      try {
        googleSub = await finishGoogleLogin(url.origin, code, saved.verifier);
      } catch (error) {
        console.error("Google 登入失敗", error);
        return finish("error");
      }

      const db = useDb(event);
      const player = await findOrCreateGooglePlayer(db, googleSub);
      const { token, expiresAt } = await createSession(db, player.id);
      setSessionCookie(event, token, expiresAt);
      // 這個瀏覽器的訪客併進帳號（精準停車設計稿第 33 題，T13）。失敗不影響登入，下次讀 /api/me 再併
      if (FLAGS.leaderboard) await absorbGuest(event, db, player.id);
      return finish("ok");
    },
    // 從 Google 導回來是一般的頁面跳轉，不帶本站的 Origin；改用 state 防偽造
    { checkOrigin: false },
  ),
);
