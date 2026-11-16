/**
 * 站名與各語言的寫法。漢字語言顯示漢字，其他語言用日文讀音的羅馬拼音；
 * 韓文用韓文字母音譯。每個站固定對應一張月台背景。
 */
export const STATION_IDS = [
  "aoba",
  "kawaguchi",
  "sakurazaka",
  "kitawan",
  "hoshimi",
  "kirihara",
  "umihama",
] as const;

export type StationId = (typeof STATION_IDS)[number];

export type StationName = {
  /** 站牌上的大字 */
  name: string;
  /** 站牌上的小字：漢字語言放拼音，其他語言放漢字 */
  sub: string;
};

type Script = "hant" | "hans" | "ja" | "ko" | "latin";

const names: Record<StationId, { hant: string; hans: string; ja: string; ko: string; latin: string }> = {
  aoba: { hant: "青葉", hans: "青叶", ja: "青葉", ko: "아오바", latin: "Aoba" },
  kawaguchi: { hant: "河口", hans: "河口", ja: "河口", ko: "가와구치", latin: "Kawaguchi" },
  sakurazaka: { hant: "櫻坂", hans: "樱坂", ja: "桜坂", ko: "사쿠라자카", latin: "Sakurazaka" },
  kitawan: { hant: "北灣", hans: "北湾", ja: "北湾", ko: "기타완", latin: "Kitawan" },
  hoshimi: { hant: "星見", hans: "星见", ja: "星見", ko: "호시미", latin: "Hoshimi" },
  kirihara: { hant: "霧原", hans: "雾原", ja: "霧原", ko: "기리하라", latin: "Kirihara" },
  umihama: { hant: "海濱", hans: "海滨", ja: "海浜", ko: "우미하마", latin: "Umihama" },
};

const scriptOf: Record<string, Script> = {
  "zh-TW": "hant",
  "zh-CN": "hans",
  ja: "ja",
  ko: "ko",
  en: "latin",
  vi: "latin",
  pt: "latin",
};

export function stationName(id: StationId, locale: string): StationName {
  const entry = names[id];
  const script = scriptOf[locale] ?? "latin";
  if (script === "latin") return { name: entry.latin, sub: entry.hant };
  return { name: entry[script], sub: entry.latin };
}

/** 月台背景圖的檔名（不含路徑） */
export function stationBackground(id: StationId): string {
  return `bg-${id}.webp`;
}

/** 夜間站：列車開頭燈、特效配色略調 */
export function isNightStation(id: StationId): boolean {
  return id === "hoshimi";
}
