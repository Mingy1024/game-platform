/**
 * 登入後要回去的網址。只接受站內路徑，避免被拿來把人導到別的網站（open redirect）。
 * 不合格就回首頁。
 */
export function safeReturnPath(value: string | null | undefined): string {
  if (!value || value.length > 512) return "/";
  // 一定要是 / 開頭；// 和 /\ 會被瀏覽器當成別的網域
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  // 控制字元（含換行、tab）一律不收
  // eslint-disable-next-line no-control-regex -- 就是要比對控制字元
  if (/[\u0000-\u001f\u007f]/.test(value)) return "/";
  try {
    const url = new URL(value, "https://site.invalid");
    if (url.origin !== "https://site.invalid") return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

/** 在站內路徑加上 login=ok／error，保留原本的查詢參數和 #錨點 */
export function withLoginResult(path: string, result: "ok" | "error"): string {
  const url = new URL(safeReturnPath(path), "https://site.invalid");
  url.searchParams.set("login", result);
  return `${url.pathname}${url.search}${url.hash}`;
}
