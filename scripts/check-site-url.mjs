// 部署到正式環境前檢查 SITE_URL（npm run cf:deploy 會在建置前後各執行一次）。
//
//   node scripts/check-site-url.mjs           建置前：SITE_URL 一定要是 https 的正式網址
//   node scripts/check-site-url.mjs --built   建置後：抽查預先產生的頁面，canonical 和 og:image 真的用了這個網址
//
// SITE_URL 在建置時寫進頁面（canonical、hreflang、社群預覽），預先產生的頁面由 Cloudflare 直接提供，
// 部署後再改 Worker 的環境變數也改不到，所以忘了設定時要在部署前擋下來。
import { existsSync, readFileSync } from "node:fs";
import "dotenv/config";

const fail = (message) => {
  console.error(`✘ ${message}`);
  process.exit(1);
};

const raw = process.env.SITE_URL;
if (!raw) fail("沒有設定 SITE_URL。正式建置要設成正式網址，例如 SITE_URL=https://example.com npm run cf:deploy");

let site;
try {
  site = new URL(raw);
} catch {
  fail(`SITE_URL 不是有效的網址：${raw}`);
}
if (site.protocol !== "https:") fail(`SITE_URL 要用 https：${raw}`);
if (["localhost", "127.0.0.1", "0.0.0.0"].includes(site.hostname) || site.hostname.endsWith(".local")) {
  fail(`SITE_URL 不能是本機網址：${raw}`);
}
const origin = site.origin;

if (process.argv.includes("--built")) {
  const page = ".output/public/games/precise-stop/index.html";
  if (!existsSync(page)) fail(`找不到建置結果 ${page}，請先執行 nuxt build`);
  const html = readFileSync(page, "utf8");
  const canonical = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/)?.[1];
  const ogImage = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)?.[1];
  for (const [name, value] of [
    ["canonical", canonical],
    ["og:image", ogImage],
  ]) {
    if (!value) fail(`${page} 沒有 ${name}`);
    if (!value.startsWith(`${origin}/`)) fail(`${page} 的 ${name} 是 ${value}，不是 ${origin}；請確認建置時有設定 SITE_URL`);
  }
  console.log(`✔ 建置結果的 canonical、og:image 都使用 ${origin}`);
} else {
  console.log(`✔ SITE_URL：${origin}`);
}
