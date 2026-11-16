import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { LOCALES, localeInfo, localePath, type Locale } from "@/lib/i18n/locales";

export const SITE_URL = process.env.SITE_URL ?? "http://localhost:3000";

/** 根版面的 metadata：網站名稱與標題樣板 */
export function siteMetadata(locale: Locale): Metadata {
  const dict = getDictionary(locale);
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${dict.brand}｜${dict.tagline}`,
      template: `%s｜${dict.brand}`,
    },
    description: dict.description,
  };
}

/**
 * 有翻譯的頁面要標出每個語言版本的網址（hreflang），
 * path 是不含語言前綴的路徑，例如 /games/precise-stop。
 */
export function localeAlternates(locale: Locale, path: string): Metadata["alternates"] {
  const languages: Record<string, string> = {};
  for (const item of LOCALES) languages[localeInfo[item].htmlLang] = localePath(item, path);
  languages["x-default"] = localePath("zh-TW", path);
  return { canonical: localePath(locale, path), languages };
}
