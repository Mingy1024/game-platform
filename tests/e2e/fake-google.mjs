// E2E 測試用的假 Google OAuth 端點（只在測試時啟動，見 playwright.config.ts）。
//
//   GET  /authorize  直接導回網站，不顯示任何畫面
//   POST /token      用 code 換 ID token（有檢查 PKCE）
//
// 測試可以在 localhost:3999 設 cookie 控制結果：
//   fake_sub=<代碼>  登入成哪個 Google 帳號（預設 test-user）
//   fake_deny=1      模擬使用者在 Google 畫面按「取消」
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";

const PORT = Number(process.env.FAKE_GOOGLE_PORT ?? 3999);
const BASE = `http://localhost:${PORT}`;
const codes = new Map();

const b64url = (value) => Buffer.from(value).toString("base64url");

function cookie(req, name) {
  const match = (req.headers.cookie ?? "").match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

createServer(async (req, res) => {
  const url = new URL(req.url, BASE);

  if (req.method === "GET" && url.pathname === "/authorize") {
    const back = new URL(url.searchParams.get("redirect_uri"));
    back.searchParams.set("state", url.searchParams.get("state") ?? "");
    if (cookie(req, "fake_deny") === "1") {
      back.searchParams.set("error", "access_denied");
    } else {
      const code = randomBytes(16).toString("hex");
      codes.set(code, {
        clientId: url.searchParams.get("client_id"),
        challenge: url.searchParams.get("code_challenge"),
        sub: cookie(req, "fake_sub") ?? "test-user",
      });
      back.searchParams.set("code", code);
    }
    res.writeHead(302, { Location: back.toString() }).end();
    return;
  }

  if (req.method === "POST" && url.pathname === "/token") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const form = new URLSearchParams(body);
    const saved = codes.get(form.get("code"));
    codes.delete(form.get("code"));
    const verifier = form.get("code_verifier") ?? "";
    if (!saved || createHash("sha256").update(verifier).digest("base64url") !== saved.challenge) {
      res.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "invalid_grant" }));
      return;
    }
    const now = Math.floor(Date.now() / 1000);
    const idToken = [
      b64url(JSON.stringify({ alg: "none", typ: "JWT" })),
      b64url(JSON.stringify({ iss: BASE, aud: saved.clientId, sub: saved.sub, iat: now, exp: now + 3600 })),
      "",
    ].join(".");
    res
      .writeHead(200, { "Content-Type": "application/json" })
      .end(JSON.stringify({ access_token: "fake", token_type: "Bearer", expires_in: 3600, id_token: idToken }));
    return;
  }

  if (url.pathname === "/health") {
    res.writeHead(200).end("ok");
    return;
  }

  res.writeHead(404).end();
}).listen(PORT, () => console.log(`假 Google 端點：${BASE}`));
