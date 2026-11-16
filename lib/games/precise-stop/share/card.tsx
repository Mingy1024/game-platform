import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { fmt, formatNumber } from "@/lib/i18n/format";
import { localeInfo, type Locale } from "@/lib/i18n/locales";
import type { Judgement } from "../scoring";
import type { DecodedRun } from "../share-code";
import { stationName } from "../stations";

/**
 * 成績圖（1080×1350）。分享面板、下載和社群預覽用的都是這一張，
 * 所以玩家看到的和貼到社群上的完全一樣。
 *
 * 字型是只含成績圖用字的子集（assets/share/fonts），
 * 文字表或站名有變動時要重新執行 scripts/fetch-share-fonts.mjs。
 */
/** 讓文字塞進指定寬度的字級：全形字算 1 個字寬，拉丁字母約 0.58 */
function fitSize(label: string, width: number, max: number): number {
  const units = [...label].reduce((sum, char) => sum + (char.charCodeAt(0) > 0x2e7f ? 1 : 0.58), 0);
  return Math.min(max, Math.floor(width / Math.max(1, units)));
}

export const CARD_SIZE = { width: 1080, height: 1350 };

const ASSETS = join(process.cwd(), "assets", "share");
const FONT_FILES = ["round", "sc", "kr", "latin"] as const;
type FontName = (typeof FONT_FILES)[number];

const primaryFont: Record<Locale, FontName> = {
  "zh-TW": "round",
  ja: "round",
  "zh-CN": "sc",
  ko: "kr",
  en: "latin",
  vi: "latin",
  pt: "latin",
};

let assets: Promise<{
  hero: string;
  fonts: { name: FontName; data: Buffer; weight: 700 | 900; style: "normal" }[];
}> | null = null;

function loadAssets() {
  assets ??= (async () => {
    const hero = await readFile(join(ASSETS, "hero.jpg"));
    const fonts = await Promise.all(
      FONT_FILES.flatMap((name) =>
        ([700, 900] as const).map(async (weight) => ({
          name,
          weight,
          style: "normal" as const,
          data: await readFile(join(ASSETS, "fonts", `${name}-${weight}.ttf`)),
        })),
      ),
    );
    return { hero: `data:image/jpeg;base64,${hero.toString("base64")}`, fonts };
  })();
  return assets;
}

const tone: Record<Judgement, string> = {
  perfect: "#4fd69c",
  great: "#8fb0ff",
  good: "#ffffff",
  fair: "#c9cfd8",
  miss: "#ff8a57",
};

const pill = {
  display: "flex",
  alignItems: "center",
  borderRadius: 999,
  fontWeight: 900,
} as const;

export async function renderCard(run: DecodedRun, locale: Locale): Promise<ImageResponse> {
  const { hero, fonts } = await loadAssets();
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

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#10131a",
          color: "#ffffff",
          fontFamily: family,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- 伺服器端繪圖，不是網頁上的圖片 */}
        <img src={hero} width={1080} height={1620} style={{ position: "absolute", left: 0, top: -375 }} />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 1080,
            height: 1350,
            display: "flex",
            background:
              "linear-gradient(rgba(16,19,26,0.15) 0%, rgba(16,19,26,0) 18%, rgba(16,19,26,0) 34%, rgba(16,19,26,0.8) 50%, #10131a 62%)",
          }}
        />

        <div
          style={{
            position: "absolute",
            left: 50,
            right: 50,
            top: 45,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ ...pill, background: "#ffffff", color: "#1d3a8f", fontSize: 32, padding: "12px 30px 12px 14px" }}>
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: 14,
                background: "#1d3a8f",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 14,
              }}
            >
              <div style={{ width: 22, height: 22, borderRadius: 11, background: "#ffc83d", border: "5px solid #ffffff" }} />
            </div>
            {dict.brand}
          </div>
          <div style={{ ...pill, background: "#cc4409", fontSize: 32, padding: "12px 30px" }}>{modeLabel}</div>
        </div>

        <div
          style={{
            position: "absolute",
            left: 50,
            right: 50,
            top: 580,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              background: "#ffffff",
              color: "#1d3a8f",
              border: "8px solid #1d3a8f",
              borderRadius: 26,
              padding: "6px 44px",
              fontSize: titleSize,
              fontWeight: 900,
            }}
          >
            {text.title}
          </div>
          <div style={{ display: "flex", fontSize: 160, fontWeight: 900, lineHeight: 1.05, marginTop: 10, textShadow: "0 8px 0 #cc4409" }}>
            {formatNumber(run.total, locale)}
          </div>
          <div style={{ ...pill, background: "#ffc83d", color: "#14171f", fontSize: 32, padding: "8px 30px", marginTop: 18 }}>
            {run.newRecord ? `${text.card.newRecord} · ${summary}` : summary}
          </div>
        </div>

        <div style={{ position: "absolute", left: 50, right: 50, top: 970, display: "flex", justifyContent: "space-between" }}>
          {run.stops.map((stop, index) => {
            const result = run.results[index];
            const name = stationName(stop.station, locale).name;
            return (
              <div
                key={stop.station}
                style={{
                  width: 184,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  background: "#1b2030",
                  borderRadius: 30,
                  borderTop: `10px solid ${tone[result.judgement]}`,
                  padding: "16px 6px 16px",
                }}
              >
                <div style={{ display: "flex", fontSize: fitSize(name, 170, 28), fontWeight: 700, color: "#aab3c5" }}>
                  {name}
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: fitSize(text.judgement[result.judgement], 170, 36),
                    fontWeight: 900,
                    color: tone[result.judgement],
                    marginTop: 4,
                  }}
                >
                  {text.judgement[result.judgement]}
                </div>
                <div style={{ display: "flex", fontSize: 30, fontWeight: 700, marginTop: 4 }}>
                  {formatNumber(result.score, locale)}
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            position: "absolute",
            left: 50,
            right: 50,
            bottom: 44,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <div style={{ display: "flex", fontSize: 44, fontWeight: 900, color: "#ffc83d" }}>{text.card.invite}</div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "#c9cfd8", marginTop: 4 }}>
            {run.mode === "daily" ? text.card.dailyNote : text.card.freeNote}
          </div>
        </div>
      </div>
    ),
    {
      ...CARD_SIZE,
      fonts,
      headers: {
        // 內容完全由代碼決定，可以長期快取
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
  );
}
