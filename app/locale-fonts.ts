import { Noto_Sans_KR, Noto_Sans_SC, Nunito } from "next/font/google";
import type { Locale } from "@/lib/i18n/locales";
import { round } from "./fonts";

/* 圓體沒有簡體字、韓文，越南文的聲調符號也不完整，這三類語言改用各自完整的字型 */
const simplified = Noto_Sans_SC({
  variable: "--font-sc",
  weight: ["400", "700", "900"],
  display: "swap",
  preload: false,
});

const korean = Noto_Sans_KR({
  variable: "--font-kr",
  weight: ["400", "700", "900"],
  display: "swap",
  preload: false,
});

const latin = Nunito({
  variable: "--font-latin",
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "700", "900"],
  display: "swap",
});

/** 其他語言的頁面：載入全部字型變數，由 --font-locale 決定主要字型 */
export const localeFontClass = `${round.variable} ${simplified.variable} ${korean.variable} ${latin.variable}`;

const primary: Partial<Record<Locale, string>> = {
  "zh-CN": "var(--font-sc)",
  ko: "var(--font-kr)",
  en: "var(--font-latin)",
  vi: "var(--font-latin)",
  pt: "var(--font-latin)",
};

/** 該語言的主要字型（CSS 值）；沒有指定時用圓體 */
export function localeFontFamily(locale: Locale): string {
  return primary[locale] ?? "var(--font-round)";
}
