// 正式站網址（SITE_URL）的檢查規則，scripts/check-site-url.mjs 和單元測試共用。

/** 保留給本機、測試、範例用的網域，不會是正式網址 */
const RESERVED_SUFFIXES = ["localhost", "local", "internal", "test", "invalid", "example", "home.arpa", "lan"];

/**
 * 檢查 SITE_URL 是不是可以用在正式站的網址：純粹的 https origin、正式網域。
 * 通過時回傳 { origin }，否則回傳 { error }。
 * @param {string | undefined} raw
 * @returns {{ origin: string } | { error: string }}
 */
export function checkSiteUrl(raw) {
  if (!raw) return { error: "沒有設定 SITE_URL。正式建置要設成正式網址，例如 SITE_URL=https://example.com npm run cf:deploy" };
  let url;
  try {
    url = new URL(raw);
  } catch {
    return { error: `SITE_URL 不是有效的網址：${raw}` };
  }
  if (url.protocol !== "https:") return { error: `SITE_URL 要用 https：${raw}` };
  if (url.username || url.password) return { error: `SITE_URL 不能包含帳號密碼：${raw}` };
  if (url.port) return { error: `SITE_URL 不能指定連接埠：${raw}` };
  if (url.pathname !== "/" || url.search || url.hash) {
    return { error: `SITE_URL 只能是網站的根網址（例如 https://example.com），不能帶路徑或參數：${raw}` };
  }
  const host = url.hostname.toLowerCase();
  // 結尾帶點的完整網域（https://localhost.）和不帶點的是同一個主機，但會讓下面的保留網域比對失效；
  // 正式站的網址也不該這樣寫，直接拒絕
  if (host.endsWith(".")) return { error: `SITE_URL 的網域不能以「.」結尾：${raw}` };
  // IPv6（[::1] 等）和 IPv4 都不接受：正式站要用網域，也擋掉本機與私有網段
  if (host.startsWith("[") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return { error: `SITE_URL 要用網域，不能是 IP 位址：${raw}` };
  if (!host.includes(".") || RESERVED_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))) {
    return { error: `SITE_URL 不能是本機或保留網域：${raw}` };
  }
  return { origin: url.origin };
}
