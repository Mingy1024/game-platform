import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import satori, { init } from "satori/standalone";
import { LOCALES } from "@/lib/i18n/locales";
import { CARD_FONT_FILES, CARD_SIZE, cardTree } from "../share/card";
import { decodeRun, encodeRun } from "../share-code";
import { STATION_IDS } from "../stations";

/**
 * 成績圖的版面能被 satori 排出來（正式站在 Workers 上用同一套排版，見 server/utils/og-image.ts）。
 * satori 對版面有限制（例如多個子元素的 div 一定要 display: flex），違反時整張圖會失敗。
 */
const fonts = CARD_FONT_FILES.flatMap((name) =>
  ([700, 900] as const).map((weight) => ({
    name,
    weight,
    style: "normal" as const,
    data: readFileSync(`public/share-card/fonts/${name}-${weight}.ttf`),
  })),
);
const hero = `data:image/jpeg;base64,${readFileSync("public/share-card/hero.jpg").toString("base64")}`;

const code = encodeRun({
  mode: "daily",
  dateKey: "2026-11-21",
  newRecord: true,
  stops: STATION_IDS.slice(0, 5).map((station, index) => ({
    station,
    errorMm: [0, 120, -300, 900, 2500][index],
    overtimeTenths: [0, 0, 5, 0, 12][index],
  })),
});

describe("J6 成績圖", () => {
  beforeAll(async () => {
    await init(readFileSync("node_modules/satori/yoga.wasm"));
  });

  it.each(LOCALES)("%s 的版面排得出來，尺寸 1080×1350", async (locale) => {
    const run = decodeRun(code);
    expect(run).not.toBeNull();
    const svg = await satori(cardTree(run!, locale, hero) as never, { ...CARD_SIZE, fonts });
    expect(svg).toContain(`width="${CARD_SIZE.width}"`);
    expect(svg).toContain(`height="${CARD_SIZE.height}"`);
  });
});
