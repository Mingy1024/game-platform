import { getRouterParam } from "h3";
import { localeFromPrefix } from "@/lib/i18n/locales";

/** 成績圖（其他語言）：/<語言>/games/<slug>/r/<代碼>/card */
export default defineEventHandler((event) => {
  const locale = localeFromPrefix(getRouterParam(event, "locale"));
  if (!locale) return new Response("Not found", { status: 404 });
  return cardResponse(getRouterParam(event, "slug") ?? "", getRouterParam(event, "code") ?? "", locale, (path) => readStaticAsset(event, path));
});
