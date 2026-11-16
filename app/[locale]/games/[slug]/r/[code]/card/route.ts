import { cardResponse } from "@/lib/games/precise-stop/share/card-route";
import { localeFromPrefix } from "@/lib/i18n/locales";

/** 成績圖（其他語言）：/<語言>/games/precise-stop/r/<代碼>/card */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; code: string }> },
) {
  const { locale: prefix, code } = await params;
  const locale = localeFromPrefix(prefix);
  if (!locale) return new Response("Not found", { status: 404 });
  return cardResponse(code, locale);
}
