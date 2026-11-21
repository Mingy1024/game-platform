import type { RouteLocationNormalized } from "vue-router";
import { localeFromPrefix } from "@/lib/i18n/locales";
import { gameSlugs, SHARE_CODE } from "@/lib/routes";

/** 頁面的網址檢查（definePageMeta 的 validate）：不通過時回 404 */
export const isGameRoute = (route: RouteLocationNormalized) => gameSlugs().includes(String(route.params.slug));

export const isSharedRoute = (route: RouteLocationNormalized) =>
  isGameRoute(route) && SHARE_CODE.test(String(route.params.code));

export const isLocaleRoute = (route: RouteLocationNormalized) => localeFromPrefix(String(route.params.locale)) !== undefined;
