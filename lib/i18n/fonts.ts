import type { Locale } from "./locales";

/* 圓體沒有簡體字、韓文，越南文的聲調符號也不完整，這三類語言改用各自完整的字型（字型名稱見 app/assets/css/main.css） */
const primary: Partial<Record<Locale, string>> = {
  "zh-CN": "var(--font-sc)",
  ko: "var(--font-kr)",
  en: "var(--font-latin)",
  vi: "var(--font-latin)",
  pt: "var(--font-latin)",
};

/** 該語言的主要字型（CSS 值）；沒有指定時用圓體 */
export function localeFontFamily(locale: Locale): string | undefined {
  return primary[locale];
}
