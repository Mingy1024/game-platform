import type { Locale } from "@/lib/i18n/locales";
import { decodeRun } from "../share-code";
import { renderCard } from "./card";

/** 成績圖的路由處理：代碼無效時回 404，不會出錯 */
export async function cardResponse(code: string, locale: Locale): Promise<Response> {
  const run = decodeRun(code);
  if (!run) return new Response("Not found", { status: 404 });
  return renderCard(run, locale);
}
