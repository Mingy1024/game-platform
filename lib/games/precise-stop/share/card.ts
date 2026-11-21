import { getDictionary } from "@/lib/i18n/dictionaries";
import { fmt, formatNumber } from "@/lib/i18n/format";
import { localeInfo, type Locale } from "@/lib/i18n/locales";
import type { Judgement } from "../scoring";
import type { DecodedRun } from "../share-code";
import { stationName } from "../stations";

/**
 * 成績圖（1080×1350）的版面。分享面板、下載和社群預覽用的都是這一張，
 * 所以玩家看到的和貼到社群上的完全一樣。
 *
 * 這裡只產生版面（satori 的元素樹，和 React 元素同樣的 { type, props } 形狀），
 * 實際繪製成 PNG 在伺服器端（server/utils/og-image.ts）。
 *
 * 字型是只含成績圖用字的子集（public/share-card/fonts），
 * 文字表或站名有變動時要重新執行 scripts/fetch-share-fonts.mjs。
 */
export const CARD_SIZE = { width: 1080, height: 1350 };

export const CARD_ASSETS = "/share-card";
export const CARD_FONT_FILES = ["round", "sc", "kr", "latin"] as const;
type FontName = (typeof CARD_FONT_FILES)[number];

type Style = Record<string, string | number>;
export type CardNode = { type: string; props: { style?: Style; children?: CardChild | CardChild[]; [key: string]: unknown } };
type CardChild = CardNode | string;

function h(type: string, props: { style?: Style; [key: string]: unknown }, ...children: CardChild[]): CardNode {
  if (children.length === 0) return { type, props };
  return { type, props: { ...props, children: children.length === 1 ? children[0] : children } };
}

const div = (style: Style, ...children: CardChild[]) => h("div", { style }, ...children);

/** 讓文字塞進指定寬度的字級：全形字算 1 個字寬，拉丁字母約 0.58 */
function fitSize(label: string, width: number, max: number): number {
  const units = [...label].reduce((sum, char) => sum + (char.charCodeAt(0) > 0x2e7f ? 1 : 0.58), 0);
  return Math.min(max, Math.floor(width / Math.max(1, units)));
}

const primaryFont: Record<Locale, FontName> = {
  "zh-TW": "round",
  ja: "round",
  "zh-CN": "sc",
  ko: "kr",
  en: "latin",
  vi: "latin",
  pt: "latin",
};

const tone: Record<Judgement, string> = {
  perfect: "#4fd69c",
  great: "#8fb0ff",
  good: "#ffffff",
  fair: "#c9cfd8",
  miss: "#ff8a57",
};

const pill = { display: "flex", alignItems: "center", borderRadius: 999, fontWeight: 900 } as const;

/** 成績圖的元素樹。hero 是背景圖的 data URL。 */
export function cardTree(run: DecodedRun, locale: Locale, hero: string): CardNode {
  const dict = getDictionary(locale);
  const text = dict.preciseStop;
  const family = `${primaryFont[locale]}, round, latin`;
  const date = new Intl.DateTimeFormat(localeInfo[locale].intl, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${run.dateKey}T00:00:00Z`));
  const modeLabel = run.mode === "daily" ? `${text.modes.daily} ${date}` : text.modes.free;
  const onTarget = run.results.filter((result) => result.streak > 0).length;
  const summary = fmt(text.card.stopped, { count: onTarget });
  // 站名或標題比較長的語言，字級縮小一點
  const titleSize = [...text.title].length > 10 ? 44 : 54;

  const stations = run.stops.map((stop, index) => {
    const result = run.results[index];
    const name = stationName(stop.station, locale).name;
    const label = text.judgement[result.judgement];
    return div(
      {
        width: 184,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: "#1b2030",
        borderRadius: 30,
        borderTop: `10px solid ${tone[result.judgement]}`,
        padding: "16px 6px 16px",
      },
      div({ display: "flex", fontSize: fitSize(name, 170, 28), fontWeight: 700, color: "#aab3c5" }, name),
      div(
        { display: "flex", fontSize: fitSize(label, 170, 36), fontWeight: 900, color: tone[result.judgement], marginTop: 4 },
        label,
      ),
      div({ display: "flex", fontSize: 30, fontWeight: 700, marginTop: 4 }, formatNumber(result.score, locale)),
    );
  });

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
      background:
        "linear-gradient(rgba(16,19,26,0.15) 0%, rgba(16,19,26,0) 18%, rgba(16,19,26,0) 34%, rgba(16,19,26,0.8) 50%, #10131a 62%)",
    }),

    div(
      { position: "absolute", left: 50, right: 50, top: 45, display: "flex", justifyContent: "space-between", alignItems: "center" },
      div(
        { ...pill, background: "#ffffff", color: "#1d3a8f", fontSize: 32, padding: "12px 30px 12px 14px" },
        div(
          {
            width: 50,
            height: 50,
            borderRadius: 14,
            background: "#1d3a8f",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 14,
          },
          div({ width: 22, height: 22, borderRadius: 11, background: "#ffc83d", border: "5px solid #ffffff" }),
        ),
        dict.brand,
      ),
      div({ ...pill, background: "#cc4409", fontSize: 32, padding: "12px 30px" }, modeLabel),
    ),

    div(
      { position: "absolute", left: 50, right: 50, top: 580, display: "flex", flexDirection: "column", alignItems: "center" },
      div(
        {
          display: "flex",
          background: "#ffffff",
          color: "#1d3a8f",
          border: "8px solid #1d3a8f",
          borderRadius: 26,
          padding: "6px 44px",
          fontSize: titleSize,
          fontWeight: 900,
        },
        text.title,
      ),
      div(
        { display: "flex", fontSize: 160, fontWeight: 900, lineHeight: 1.05, marginTop: 10, textShadow: "0 8px 0 #cc4409" },
        formatNumber(run.total, locale),
      ),
      div(
        { ...pill, background: "#ffc83d", color: "#14171f", fontSize: 32, padding: "8px 30px", marginTop: 18 },
        run.newRecord ? `${text.card.newRecord} · ${summary}` : summary,
      ),
    ),

    div({ position: "absolute", left: 50, right: 50, top: 970, display: "flex", justifyContent: "space-between" }, ...stations),

    div(
      {
        position: "absolute",
        left: 50,
        right: 50,
        bottom: 44,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
      },
      div({ display: "flex", fontSize: 44, fontWeight: 900, color: "#ffc83d" }, text.card.invite),
      div(
        { display: "flex", fontSize: 30, fontWeight: 700, color: "#c9cfd8", marginTop: 4 },
        run.mode === "daily" ? text.card.dailyNote : text.card.freeNote,
      ),
    ),
  );
}
