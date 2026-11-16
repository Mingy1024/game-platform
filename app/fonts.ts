import { Chiron_GoRound_TC } from "next/font/google";

/*
 * 圓體呼應站名牌。中文字型檔很大，不預載，交給 unicode-range 按需下載。
 * 這個檔案只放繁體中文頁面需要的字型：next/font 的 CSS 跟著 import 走，
 * 其他語言的字型放在 locale-fonts.ts，繁中頁面就不會載入它們的 CSS。
 */
export const round = Chiron_GoRound_TC({
  variable: "--font-round",
  subsets: ["latin"],
  display: "swap",
  preload: false,
  // next/font 沒有這個字型的度量資料，無法產生對應的備用字型
  adjustFontFallback: false,
});

/** 繁體中文頁面只需要圓體 */
export const defaultFontClass = round.variable;
