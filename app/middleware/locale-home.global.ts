import { LOCALE_COOKIE, rememberedHomePath } from "@/lib/i18n/locales";

/**
 * 站內換頁回到繁中首頁（例如點頁首的站名）時，也沿用使用者上次自己選的語言。
 * 直接打開或重新整理 / 時由伺服器轉址（server/middleware/site-routes.ts），這裡只處理瀏覽器端換頁。
 */
export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server || to.path !== "/") return;
  if (useNuxtApp().isHydrating) return;
  const home = rememberedHomePath(useCookie(LOCALE_COOKIE).value);
  // 不指定 replace：沿用這次換頁原本的方式（點連結是新增一筆紀錄），上一頁才會回到原本的頁面。
  // 查詢參數和錨點一起帶過去（例如登入結果 ?login=）
  if (home) return navigateTo({ path: home, query: to.query, hash: to.hash });
});
