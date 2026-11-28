// 下載成績圖用的字型子集。成績圖由伺服器產生（lib/games/precise-stop/share/card.tsx），
// 需要 TTF 字型檔；完整的中日韓字型很大，所以只抓成績圖會用到的字。
//
// 文字表或站名有變動時重新執行：  node scripts/fetch-share-fonts.mjs
// （需要 Node 24 以上，會連到 Google Fonts）
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";

const OUT = new URL("../public/share-card/fonts/", import.meta.url);
const dict = async (file, name) => (await import(`../lib/i18n/dictionaries/${file}.ts`))[name];
const { STATION_IDS, stationName } = await import("../lib/games/precise-stop/stations.ts");

const locales = {
  "zh-TW": await dict("zh-TW", "zhTW"),
  "zh-CN": await dict("zh-CN", "zhCN"),
  en: await dict("en", "en"),
  ja: await dict("ja", "ja"),
  ko: await dict("ko", "ko"),
  vi: await dict("vi", "vi"),
  pt: await dict("pt", "pt"),
};

/** 成績圖上會出現的所有文字 */
function cardText(locale, d) {
  const game = d.preciseStop;
  const stations = STATION_IDS.flatMap((id) => Object.values(stationName(id, locale)));
  // 下班逃離辦公室的成績圖：標題、各結局的標題與說明、四項得分名稱、邀請文案
  const office = d.officeEscape;
  const officeText = [
    office.title,
    ...Object.values(office.final.endings).flatMap((ending) => [ending.title, ending.body]),
    ...Object.values(office.final.parts),
    ...Object.values(office.card),
  ];
  // 礦坑大逃亡的成績圖：標題、三項得分名稱、邀請文案與深度那一行
  const mine = d.mineDescent;
  const mineText = [mine.title, mine.hud.unit, ...Object.values(mine.final.parts), ...Object.values(mine.card)];
  // 和尚端湯上塔的成績圖：標題、模式、塔號、湯量／溫度／時間與溫度的說法、邀請文案
  const monk = d.monkSoupTower;
  const monkText = [monk.title, ...Object.values(monk.modes), monk.final.seed, monk.final.seconds, ...Object.values(monk.bands), ...Object.values(monk.card), "#℃SABC"];
  return [
    ...officeText,
    ...mineText,
    ...monkText,
    d.brand,
    game.title,
    game.modes.daily,
    game.modes.free,
    ...Object.values(game.card),
    ...Object.values(game.judgement),
    ...stations,
  ].join("");
}

const COMMON = "0123456789 ,.·/+-−×:：()（）！？!?%";
const text = (ids) => [...new Set((ids.map((id) => cardText(id, locales[id])).join("") + COMMON))].sort().join("");

const FONTS = [
  { file: "round", family: "Chiron GoRound TC", chars: text(["zh-TW", "ja"]) },
  { file: "sc", family: "Noto Sans SC", chars: text(["zh-CN"]) },
  { file: "kr", family: "Noto Sans KR", chars: text(["ko"]) },
  { file: "latin", family: "Nunito", chars: text(["en", "vi", "pt"]) },
];
const WEIGHTS = [700, 900];
// 舊版瀏覽器的 UA：Google Fonts 會回傳 TTF（伺服器端的繪圖程式不支援 WOFF2）
const UA = "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1";

await mkdir(OUT, { recursive: true });
for (const name of await readdir(OUT)) if (name.endsWith(".ttf")) await rm(new URL(name, OUT));

for (const font of FONTS) {
  for (const weight of WEIGHTS) {
    const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font.family)}:wght@${weight}&text=${encodeURIComponent(font.chars)}`;
    const css = await (await fetch(url, { headers: { "User-Agent": UA } })).text();
    const match = css.match(/src:\s*url\(([^)]+)\)\s*format\('truetype'\)/);
    if (!match) throw new Error(`${font.family} ${weight}：沒有拿到 TTF\n${css.slice(0, 300)}`);
    const data = Buffer.from(await (await fetch(match[1])).arrayBuffer());
    await writeFile(new URL(`${font.file}-${weight}.ttf`, OUT), data);
    console.log(`${font.file}-${weight}.ttf`, `${font.chars.length} 字`, `${(data.length / 1024).toFixed(1)} KB`);
  }
}
