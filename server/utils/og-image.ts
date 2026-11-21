import { initWasm, Resvg } from "@resvg/resvg-wasm";
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm?module";
import satori, { init as initSatori } from "satori/standalone";
import yogaWasm from "satori/yoga.wasm?module";
import { decodeRun } from "@/lib/games/precise-stop/share-code";
import { CARD_ASSETS, CARD_FONT_FILES, CARD_SIZE, cardTree } from "@/lib/games/precise-stop/share/card";
import type { Locale } from "@/lib/i18n/locales";

/*
 * 成績圖的繪製：satori 排版成 SVG，resvg 轉成 PNG（取代原本 next/og 的 ImageResponse，內部是同一套工具）。
 * 兩者都是 WebAssembly，以模組方式匯入（nuxt.config.ts 的 nitro.experimental.wasm），
 * Workers 不允許執行時才編譯 WebAssembly，這樣才能在 Workers 上執行。
 *
 * satori 固定在 0.32.0：0.33 起加入 HarfBuzz（harfbuzzjs，0.35 起內建），它的 WebAssembly 是在執行時
 * 從位元組編譯的，Workers 不允許，成績圖會整個失敗。升級前要先在 npm run preview 確認成績圖能產生。
 */
/**
 * 只初始化一次；失敗時清掉快取讓下次重試。兩個引擎各自記住結果：
 * resvg 已經初始化成功後不能再呼叫 initWasm（會丟 Already initialized），所以不能和 satori 綁在一起重試。
 */
function once(init: () => Promise<unknown>): () => Promise<void> {
  let pending: Promise<void> | null = null;
  return () =>
    (pending ??= init().then(
      () => undefined,
      (error: unknown) => {
        pending = null;
        throw error;
      },
    ));
}
const readySatori = once(() => initSatori(yogaWasm));
const readyResvg = once(() => initWasm(resvgWasm));
const ready = () => Promise.all([readySatori(), readyResvg()]);

type Assets = {
  hero: string;
  fonts: { name: string; data: ArrayBuffer; weight: 700 | 900; style: "normal" }[];
};
let assets: Promise<Assets> | null = null;

const toArrayBuffer = (bytes: Uint8Array) =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

function loadAssets(read: (path: string) => Promise<Uint8Array>): Promise<Assets> {
  assets ??= (async () => {
    const hero = await read(`${CARD_ASSETS}/hero.jpg`);
    const fonts = await Promise.all(
      CARD_FONT_FILES.flatMap((name) =>
        ([700, 900] as const).map(async (weight) => ({
          name,
          weight,
          style: "normal" as const,
          data: toArrayBuffer(await read(`${CARD_ASSETS}/fonts/${name}-${weight}.ttf`)),
        })),
      ),
    );
    return { hero: `data:image/jpeg;base64,${Buffer.from(hero).toString("base64")}`, fonts };
  })().catch((error) => {
    // 讀檔失敗不要把錯誤留在快取裡，下次請求重試
    assets = null;
    throw error;
  });
  return assets;
}

/** 成績圖的回應：代碼無效時回 404，不會出錯。read：讀 public/ 底下的檔案 */
export async function cardResponse(
  code: string,
  locale: Locale,
  read: (path: string) => Promise<Uint8Array>,
): Promise<Response> {
  const run = decodeRun(code);
  if (!run) return new Response("Not found", { status: 404 });
  const [{ hero, fonts }] = await Promise.all([loadAssets(read), ready()]);
  // satori 的型別是 React 元素；這裡給的是同樣形狀的純物件
  const svg = await satori(cardTree(run, locale, hero) as never, { ...CARD_SIZE, fonts });
  const png = new Resvg(svg, { fitTo: { mode: "width", value: CARD_SIZE.width } }).render().asPng();
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      // 內容完全由代碼決定，可以長期快取
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
