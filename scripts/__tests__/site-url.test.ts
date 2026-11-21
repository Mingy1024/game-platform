import { describe, expect, it } from "vitest";
import { checkSiteUrl } from "../site-url.mjs";

describe("部署前檢查 SITE_URL", () => {
  it("接受 https 的正式網域，回傳 origin", () => {
    expect(checkSiteUrl("https://games.example.com")).toEqual({ origin: "https://games.example.com" });
    expect(checkSiteUrl("https://games.example.com/")).toEqual({ origin: "https://games.example.com" });
  });

  it.each([
    [undefined, "沒有設定"],
    ["", "沒有設定"],
    ["not a url", "不是有效的網址"],
    ["http://games.example.com", "https"],
    ["https://localhost", "本機或保留網域"],
    ["https://app.localhost", "本機或保留網域"],
    ["https://mybox.local", "本機或保留網域"],
    ["https://site.test", "本機或保留網域"],
    ["https://intranet", "本機或保留網域"],
    ["https://[::1]", "IP 位址"],
    ["https://127.0.0.1", "IP 位址"],
    ["https://192.168.0.16", "IP 位址"],
    ["https://10.0.0.1", "IP 位址"],
    ["https://games.example.com:8443", "連接埠"],
    ["https://user:pass@games.example.com", "帳號密碼"],
    ["https://games.example.com/zh", "根網址"],
    ["https://games.example.com/?a=1", "根網址"],
  ])("拒絕 %s", (raw, message) => {
    const result = checkSiteUrl(raw);
    expect("error" in result && result.error).toContain(message);
  });
});
