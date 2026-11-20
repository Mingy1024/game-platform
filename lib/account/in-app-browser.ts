/**
 * Google 不允許在 App 內建的瀏覽器登入（403 disallowed_useragent），
 * 偵測到這些 App 時，登入按鈕改成提示。
 *
 * - line-android：Android 版 LINE 會在網址加上 openExternalBrowser=1 時改用外部瀏覽器打開
 * - other：LINE（iOS）、Facebook、Instagram、Threads；iOS 沒有可靠的自動跳出方法，只能請使用者自己開
 */
export type InAppBrowser = "line-android" | "other" | null;

export function detectInAppBrowser(userAgent: string): InAppBrowser {
  if (/\bLine\//i.test(userAgent)) return /Android/i.test(userAgent) ? "line-android" : "other";
  if (/FBAN|FBAV|FB_IAB|Instagram|Barcelona/i.test(userAgent)) return "other";
  return null;
}

/** Android 版 LINE 用外部瀏覽器打開的網址 */
export function externalBrowserUrl(href: string): string {
  const url = new URL(href);
  url.searchParams.set("openExternalBrowser", "1");
  return url.toString();
}
