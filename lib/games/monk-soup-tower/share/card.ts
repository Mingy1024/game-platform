import { getDictionary } from "@/lib/i18n/dictionaries";
import { fmt, formatNumber } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/locales";
import { CARD_ASSETS, CARD_FONT_FILES, CARD_SIZE, type CardNode } from "../../precise-stop/share/card";
import type { DecodedRun } from "../share-code";
import { secondsText } from "../scoring";
import { seedLabel } from "../tower";

/**
 * 和尚端湯上塔的成績圖（1080×1350，J4）：塔的外觀圖、遊戲名、得分與評級、湯量／溫度與分段／時間、模式（隨機模式加塔號）。
 * 只產生版面（satori 的元素樹），實際繪製成 PNG 在伺服器端（server/utils/og-image.ts）。
 * 字型是只含成績圖用字的子集，文字表有變動時要重新執行 scripts/fetch-share-fonts.mjs。
 */
export { CARD_ASSETS, CARD_FONT_FILES, CARD_SIZE };
export const MONK_CARD_HERO = "monk-hero.jpg";

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

/** 讓文字塞進指定寬度的字級：全形字算 1 個字寬，拉丁字母約 0.58 */
function fitSize(label: string, width: number, max: number): number {
  const units = [...label].reduce((sum, char) => sum + (char.charCodeAt(0) > 0x2e7f ? 1 : 0.58), 0);
  return Math.min(max, Math.floor(width / Math.max(1, units)));
}

const GRADE_COLOR = { S: "#a8372c", A: "#c7802a", B: "#3d6fa8", C: "#5b6b67" } as const;

export function cardTree(run: DecodedRun, locale: Locale, hero: string): CardNode {
  const dict = getDictionary(locale);
  const text = dict.monkSoupTower;
  const family = `${primaryFont[locale]}, round, latin`;
  const mode = run.mode === "random" && run.seed !== null ? `${text.modes.random} · ${fmt(text.final.seed, { seed: seedLabel(run.seed) })}` : text.modes.fixed;
  const seconds = secondsText(run.timeMs, locale);
  const stats = [
    { label: text.card.soup, value: `${formatNumber(Math.round(run.soup / 10), locale)}%`, extra: "" },
    { label: text.card.temp, value: `${formatNumber(Math.floor(run.temp), locale)}℃`, extra: text.bands[run.band] },
    { label: text.card.time, value: fmt(text.final.seconds, { time: seconds }), extra: "" },
  ];
  const pill = { display: "flex", alignItems: "center", borderRadius: 999, fontWeight: 900 } as const;

  return div(
    { width: "100%", height: "100%", display: "flex", position: "relative", background: "#23302d", color: "#23302d", fontFamily: family },
    h("img", { src: hero, width: 1080, height: 1350, style: { position: "absolute", left: 0, top: 0 } }),
    div({
      position: "absolute",
      left: 0,
      top: 0,
      width: 1080,
      height: 1350,
      display: "flex",
      background: "linear-gradient(rgba(35,48,45,0.25) 0%, rgba(35,48,45,0) 22%, rgba(35,48,45,0) 40%, rgba(35,48,45,0.7) 58%, #23302d 72%)",
    }),
    div(
      { position: "absolute", left: 50, right: 50, top: 45, display: "flex", justifyContent: "space-between", alignItems: "center" },
      div({ ...pill, background: "#f4f7f5", color: "#23302d", fontSize: 32, padding: "12px 30px" }, dict.brand),
      run.newRecord ? div({ ...pill, background: "#e0a43a", color: "#23302d", fontSize: 32, padding: "12px 30px" }, text.card.newRecord) : div({ display: "flex" }),
    ),
    div(
      { position: "absolute", left: 50, right: 50, top: 690, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" },
      div(
        { display: "flex", background: "#7e2620", color: "#fbefc4", border: "6px solid #e0a43a", borderRadius: 22, padding: "8px 40px", fontSize: fitSize(text.title, 860, 56), fontWeight: 900 },
        text.title,
      ),
      div({ display: "flex", fontSize: fitSize(mode, 900, 34), fontWeight: 700, color: "#c9d6d1", marginTop: 18 }, mode),
      div(
        { display: "flex", alignItems: "center", marginTop: 10 },
        div(
          { display: "flex", width: 150, height: 150, borderRadius: 36, background: GRADE_COLOR[run.grade], color: "#ffffff", fontSize: 110, fontWeight: 900, alignItems: "center", justifyContent: "center", marginRight: 36 },
          run.grade,
        ),
        div({ display: "flex", fontSize: 150, fontWeight: 900, color: "#ffffff", lineHeight: 1.05 }, formatNumber(run.score, locale)),
      ),
    ),
    div(
      { position: "absolute", left: 50, right: 50, top: 1060, display: "flex", justifyContent: "space-between" },
      ...stats.map((item) =>
        div(
          { width: 310, display: "flex", flexDirection: "column", alignItems: "center", background: "#f4f7f5", borderRadius: 30, padding: "14px 6px" },
          div({ display: "flex", fontSize: fitSize(item.label, 280, 28), fontWeight: 700, color: "#5b6b67" }, item.label),
          div({ display: "flex", fontSize: 48, fontWeight: 900 }, item.value),
          item.extra ? div({ display: "flex", fontSize: fitSize(item.extra, 280, 26), fontWeight: 700, color: "#a8372c" }, item.extra) : div({ display: "flex", height: 4 }),
        ),
      ),
    ),
    div(
      { position: "absolute", left: 50, right: 50, bottom: 36, display: "flex", justifyContent: "center", textAlign: "center" },
      div({ display: "flex", fontSize: fitSize(text.card.invite, 980, 42), fontWeight: 900, color: "#e0a43a" }, text.card.invite),
    ),
  );
}
