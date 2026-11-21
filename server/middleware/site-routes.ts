import { createError, getCookie, getRequestURL, sendRedirect } from "h3";
import { LOCALE_COOKIE, rememberedHomePath } from "@/lib/i18n/locales";
import { isSitePath } from "@/lib/routes";

/**
 * 頁面渲染前先比對網址：
 * - 首頁 /：沿用使用者上次自己選的語言（gs-locale cookie，不看瀏覽器語言）
 * - 對不到目錄或語言的網址：直接回 404（由 app/error.vue 顯示「這一站沒有停靠」）
 *
 * API、Nuxt 的內部路徑和靜態檔案不經過這裡的檢查。預先產生的頁面在 Workers 上由靜態資源直接提供，
 * 也不會進到這裡；首頁沒有預先產生，所以語言轉址一定會執行。
 */
const SKIP = /^\/(?:api|_nuxt|__nuxt|_fonts)(?:\/|$)/;

export default defineEventHandler((event) => {
  if (event.method !== "GET" && event.method !== "HEAD") return;
  const { pathname } = getRequestURL(event);
  if (SKIP.test(pathname) || pathname === "/__nuxt_error") return;
  const last = pathname.split("/").at(-1) ?? "";
  // 有副檔名的是靜態檔案或 _payload.json；找不到時由後面的處理回 404
  if (last.includes(".")) return;

  let segments: string[];
  try {
    segments = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    throw createError({ statusCode: 404, statusMessage: "Not Found" });
  }

  if (segments.length === 0) {
    const home = rememberedHomePath(getCookie(event, LOCALE_COOKIE));
    return home ? sendRedirect(event, home, 307) : undefined;
  }

  if (!isSitePath(segments)) throw createError({ statusCode: 404, statusMessage: "Not Found" });
});
