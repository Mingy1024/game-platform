import { CodeChallengeMethod, OAuth2Client, decodeIdToken, generateCodeVerifier, generateState } from "arctic";

/**
 * Google 登入（OAuth 2.0 + PKCE，arctic 處理協定細節）。
 * scope 只要 openid：Google 的同意畫面不會要求名字和信箱，我們也只拿得到 sub。
 */

const GOOGLE = {
  authorize: "https://accounts.google.com/o/oauth2/v2/auth",
  token: "https://oauth2.googleapis.com/token",
  issuers: ["https://accounts.google.com", "accounts.google.com"],
};

/**
 * E2E 測試用的假 Google 端點（tests/e2e/fake-google.ts）。
 * 只有明確設定 GOOGLE_OAUTH_TEST_BASE_URL 時才會用，正式站絕對不要設。
 */
function endpoints() {
  const testBase = process.env.GOOGLE_OAUTH_TEST_BASE_URL;
  if (testBase) {
    return { authorize: `${testBase}/authorize`, token: `${testBase}/token`, issuers: [testBase] };
  }
  return GOOGLE;
}

export const OAUTH_COOKIE = "gs_oauth";
/** state 與 PKCE 的有效時間 */
export const OAUTH_COOKIE_MAX_AGE = 10 * 60;

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function client(origin: string) {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID ?? "",
    process.env.GOOGLE_CLIENT_SECRET ?? "",
    `${origin}/api/auth/google/callback`,
  );
}

export function startGoogleLogin(origin: string) {
  const state = generateState();
  const verifier = generateCodeVerifier();
  const url = client(origin).createAuthorizationURLWithPKCE(
    endpoints().authorize,
    state,
    CodeChallengeMethod.S256,
    verifier,
    ["openid"],
  );
  // 已經登入過 Google 的人不用每次都選帳號；要換帳號時 Google 畫面上可以切換
  url.searchParams.set("prompt", "select_account");
  return { url, state, verifier };
}

/**
 * 用 code 換 token，驗證 ID token，回傳 Google 帳號代碼（sub）。
 * ID token 是我們直接向 Google 的 token 端點（HTTPS）拿的，依 OpenID Connect
 * 規範可以不驗簽章，但發行者、對象、到期時間一定要檢查。
 */
export async function finishGoogleLogin(origin: string, code: string, verifier: string, now = Date.now()) {
  const tokens = await client(origin).validateAuthorizationCode(endpoints().token, code, verifier);
  const claims = decodeIdToken(tokens.idToken()) as { iss?: string; aud?: string | string[]; exp?: number; sub?: string };
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!claims.iss || !endpoints().issuers.includes(claims.iss)) throw new Error("ID token 發行者不對");
  if (!audience.includes(process.env.GOOGLE_CLIENT_ID)) throw new Error("ID token 對象不對");
  if (typeof claims.exp !== "number" || claims.exp * 1000 <= now) throw new Error("ID token 已過期");
  if (typeof claims.sub !== "string" || !claims.sub) throw new Error("ID token 沒有 sub");
  return claims.sub;
}
