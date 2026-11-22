import { getDictionary } from "@/lib/i18n/dictionaries";
import { fmt, formatNumber } from "@/lib/i18n/format";
import { localeInfo, type Locale } from "@/lib/i18n/locales";
import { CARD_ASSETS, CARD_FONT_FILES, CARD_SIZE, type CardNode } from "../../precise-stop/share/card";
import { clockFromTenths, type DecodedRun } from "../share-code";

/**
 * 下班逃離辦公室的成績圖（1080×1350）。分享面板、下載和社群預覽用的都是這一張。
 * 只產生版面（satori 的元素樹），實際繪製成 PNG 在伺服器端（server/utils/og-image.ts）。
 * 字型是只含成績圖用字的子集，文字表有變動時要重新執行 scripts/fetch-share-fonts.mjs。
 */
export { CARD_ASSETS, CARD_FONT_FILES, CARD_SIZE };
export const OFFICE_CARD_HERO = "office-hero.jpg";

type Style = Record<string, string | number>;
type CardChild = CardNode | string;

function h(type: string, props: { style?: Style; [key: string]: unknown }, ...children: CardChild[]): CardNode {
  if (children.length === 0) return { type, props };
  return { type, props: { ...props, children: children.length === 1 ? children[0] : children } };
}
const div = (style: Style, ...children: CardChild[]) => h("div", { style }, ...children);

const primaryFont: Record<Locale, (typeof CARD_FONT_FILES)[number]> = {
  "zh-TW": "round",
  ja: "round",
  "zh-CN": "sc",
  ko: "kr",
  en: "latin",
  vi: "latin",
  pt: "latin",
};

const pill = { display: "flex", alignItems: "center", borderRadius: 999, fontWeight: 900 } as const;
const tone = { fast: "#4fd69c", ontime: "#ffc83d", overtime: "#ff8a57" } as const;

/** 讓文字塞進指定寬度的字級：全形字算 1 個字寬，拉丁字母約 0.58 */
function fitSize(label: string, width: number, max: number): number {
  const units = [...label].reduce((sum, char) => sum + (char.charCodeAt(0) > 0x2e7f ? 1 : 0.58), 0);
  return Math.min(max, Math.floor(width / Math.max(1, units)));
}

/** 成績圖的元素樹。hero 是背景圖的 data URL。 */
export function cardTree(run: DecodedRun, locale: Locale, hero: string): CardNode {
  const dict = getDictionary(locale);
  const text = dict.officeEscape;
  const family = `${primaryFont[locale]}, round, latin`;
  const date = new Intl.DateTimeFormat(localeInfo[locale].intl, { year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${run.dateKey}T00:00:00Z`),
  );
  const ending = run.hidden ? text.final.endings.hidden : text.final.endings[run.ending];
  const line = run.ending === "overtime" ? ending.body : fmt(text.card.timeLine, { time: clockFromTenths(run.clockTenths) });
  const titleSize = [...text.title].length > 10 ? 44 : 54;
  const endingSize = fitSize(ending.title, 900, 64);
  const lineSize = fitSize(line, 900, 36);

  const parts = (["time", "graze", "event", "item"] as const).map((key) =>
    div(
      {
        width: 232,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: "#1b2030",
        borderRadius: 30,
        borderTop: `10px solid ${tone[run.ending]}`,
        padding: "16px 6px",
      },
      div({ display: "flex", fontSize: fitSize(text.final.parts[key], 210, 28), fontWeight: 700, color: "#aab3c5" }, text.final.parts[key]),
      div({ display: "flex", fontSize: 40, fontWeight: 900, marginTop: 6 }, formatNumber(run.parts[key], locale)),
    ),
  );

  return div(
    { width: "100%", height: "100%", display: "flex", position: "relative", background: "#10131a", color: "#ffffff", fontFamily: family },
    h("img", { src: hero, width: 1080, height: 1620, style: { position: "absolute", left: 0, top: -375 } }),
    div({
      position: "absolute",
      left: 0,
      top: 0,
      width: 1080,
      height: 1350,
      display: "flex",
      background: "linear-gradient(rgba(16,19,26,0.15) 0%, rgba(16,19,26,0) 18%, rgba(16,19,26,0) 34%, rgba(16,19,26,0.8) 50%, #10131a 62%)",
    }),
    div(
      { position: "absolute", left: 50, right: 50, top: 45, display: "flex", justifyContent: "space-between", alignItems: "center" },
      div({ ...pill, background: "#ffffff", color: "#1d3a8f", fontSize: 32, padding: "12px 30px" }, dict.brand),
      div({ ...pill, background: "#cc4409", fontSize: 32, padding: "12px 30px" }, date),
    ),
    div(
      { position: "absolute", left: 50, right: 50, top: 560, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" },
      div(
        { display: "flex", background: "#ffffff", color: "#1d3a8f", border: "8px solid #1d3a8f", borderRadius: 26, padding: "6px 44px", fontSize: titleSize, fontWeight: 900 },
        text.title,
      ),
      div({ display: "flex", fontSize: endingSize, fontWeight: 900, color: tone[run.ending], marginTop: 22 }, ending.title),
      div({ display: "flex", fontSize: 150, fontWeight: 900, lineHeight: 1.05, marginTop: 6, textShadow: "0 8px 0 #cc4409" }, formatNumber(run.total, locale)),
      div(
        { ...pill, background: "#ffc83d", color: "#14171f", fontSize: lineSize, padding: "8px 30px", marginTop: 14 },
        run.newRecord ? `${text.card.newRecord} · ${line}` : line,
      ),
    ),
    div({ position: "absolute", left: 50, right: 50, top: 1010, display: "flex", justifyContent: "space-between" }, ...parts),
    div(
      { position: "absolute", left: 50, right: 50, bottom: 44, display: "flex", justifyContent: "center", textAlign: "center" },
      div({ display: "flex", fontSize: 44, fontWeight: 900, color: "#ffc83d" }, text.card.invite),
    ),
  );
}
