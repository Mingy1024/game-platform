import { LOCALE_COOKIE, rememberedHomePath } from "@/lib/i18n/locales";

/**
 * 站內換頁回到繁中首頁（例如點頁首的站名）時，也沿用使用者上次自己選的語言。
 * 直接打開或重新整理 / 時由伺服器轉址（server/middleware/site-routes.ts），這裡只處理瀏覽器端換頁。
 */
export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server || to.path !== "/") return;
  if (useNuxtApp().isHydrating) return;
  const home = rememberedHomePath(useCookie(LOCALE_COOKIE).value);
  if (home) return navigateTo(home, { replace: true });
});
