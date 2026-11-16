import { describe, expect, it } from "vitest";
import { dictionaries } from "../dictionaries";
import { fmt, formatError, formatNumber, formatShortDate } from "../format";
import {
  LOCALES,
  PREFIXED_LOCALES,
  isTranslatedPath,
  localeFromPrefix,
  localeInfo,
  localePath,
  splitLocalePath,
  switchLocalePath,
} from "../locales";

type Leaf = { path: string; value: string };

function leaves(node: unknown, path = ""): Leaf[] {
  if (typeof node === "string") return [{ path, value: node }];
  if (Array.isArray(node)) return node.flatMap((item, index) => leaves(item, `${path}[${index}]`));
  if (node && typeof node === "object") {
    return Object.entries(node).flatMap(([key, value]) => leaves(value, path ? `${path}.${key}` : key));
  }
  throw new Error(`文字表裡有不是字串的值：${path}`);
}

const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join(",");
const master = leaves(dictionaries["zh-TW"]);
const HAN = /\p{Script=Han}/u;

describe("K5 翻譯鍵值對齊", () => {
  it("有 7 種語言", () => {
    expect(LOCALES).toEqual(["zh-TW", "zh-CN", "en", "ja", "ko", "vi", "pt"]);
    expect(Object.keys(dictionaries).sort()).toEqual([...LOCALES].sort());
  });

  it.each(LOCALES)("%s 的 key 和繁體中文完全一致", (locale) => {
    const paths = leaves(dictionaries[locale]).map((leaf) => leaf.path);
    expect(paths).toEqual(master.map((leaf) => leaf.path));
  });

  it.each(LOCALES)("%s 沒有空白字串，佔位符和繁體中文相同", (locale) => {
    const items = leaves(dictionaries[locale]);
    items.forEach((leaf, index) => {
      expect(leaf.value.trim(), leaf.path).not.toBe("");
      expect(placeholders(leaf.value), leaf.path).toBe(placeholders(master[index].value));
    });
  });

  it.each(["en", "vi", "pt", "ko"] as const)("%s 沒有殘留中文", (locale) => {
    for (const leaf of leaves(dictionaries[locale])) {
      // 站牌上的「停」只在漢字語言使用
      expect(HAN.test(leaf.value), `${leaf.path}: ${leaf.value}`).toBe(false);
    }
  });

  it("簡體中文沒有殘留繁體字", () => {
    const traditionalOnly = /[車離結們這個來時會開關點擊紀錄線準遊戲選單頁優誤擊檔圖視頻網絡鍵載歡迎對錯務實際麼為還沒過進運動員樣問題難雙從頭應該當與車門閉號機場藍綠紅黃區標題總數據庫應]/u;
    for (const leaf of leaves(dictionaries["zh-CN"])) {
      expect(traditionalOnly.test(leaf.value), `${leaf.path}: ${leaf.value}`).toBe(false);
    }
  });

  it("日文確實翻譯過：和繁體中文相同的句子不到一成", () => {
    const japanese = leaves(dictionaries.ja);
    const same = japanese.filter((leaf, index) => leaf.value === master[index].value);
    expect(same.length / japanese.length).toBeLessThan(0.1);
  });

  it("各語言的遊戲名稱、模式名稱都不同於繁體中文（確實翻譯過）", () => {
    for (const locale of ["en", "ja", "ko", "vi", "pt"] as const) {
      expect(dictionaries[locale].preciseStop.title).not.toBe(dictionaries["zh-TW"].preciseStop.title);
      expect(dictionaries[locale].preciseStop.modes.daily).not.toBe("今日挑戰");
    }
  });

  it("全站沒有殘留舊名稱「每日路線」（I9）", () => {
    for (const locale of LOCALES) {
      for (const leaf of leaves(dictionaries[locale])) {
        expect(leaf.value).not.toMatch(/每日路線|每日路线/);
      }
    }
    expect(dictionaries["zh-TW"].preciseStop.modes).toMatchObject({ daily: "今日挑戰", free: "自由模式" });
  });
});

describe("K1 語言網址", () => {
  it("繁中無前綴，其他是 /zh-cn、/en、/ja、/ko、/vi、/pt", () => {
    expect(localeInfo["zh-TW"].prefix).toBe("");
    expect(PREFIXED_LOCALES.map((locale) => localeInfo[locale].prefix)).toEqual([
      "zh-cn",
      "en",
      "ja",
      "ko",
      "vi",
      "pt",
    ]);
    expect(localePath("zh-TW", "/games/precise-stop")).toBe("/games/precise-stop");
    expect(localePath("en", "/games/precise-stop")).toBe("/en/games/precise-stop");
    expect(localePath("zh-CN", "/")).toBe("/zh-cn");
    expect(localePath("zh-TW", "/")).toBe("/");
  });

  it("從網址辨識語言", () => {
    expect(localeFromPrefix("ja")).toBe("ja");
    expect(localeFromPrefix("zh-cn")).toBe("zh-CN");
    expect(localeFromPrefix("games")).toBeUndefined();
    expect(splitLocalePath("/ko/games/precise-stop")).toEqual({ locale: "ko", path: "/games/precise-stop" });
    expect(splitLocalePath("/games/precise-stop")).toEqual({ locale: "zh-TW", path: "/games/precise-stop" });
    expect(splitLocalePath("/pt")).toEqual({ locale: "pt", path: "/" });
  });
});

describe("K2 切換語言留在同一頁", () => {
  it("首頁和遊戲介紹頁留在同一頁", () => {
    expect(switchLocalePath("/games/precise-stop", "en")).toBe("/en/games/precise-stop");
    expect(switchLocalePath("/en/games/precise-stop", "zh-TW")).toBe("/games/precise-stop");
    expect(switchLocalePath("/ja", "ko")).toBe("/ko");
    expect(switchLocalePath("/", "vi")).toBe("/vi");
    expect(switchLocalePath("/en/games/precise-stop/r/abc_DEF-1", "ja")).toBe("/ja/games/precise-stop/r/abc_DEF-1");
  });

  it("還沒翻譯的頁面回到該語言的首頁", () => {
    expect(isTranslatedPath("/about")).toBe(false);
    expect(switchLocalePath("/about", "en")).toBe("/en");
    expect(switchLocalePath("/hot", "zh-TW")).toBe("/");
  });

  it("語言名稱用各語言自己的寫法", () => {
    expect(LOCALES.map((locale) => localeInfo[locale].nativeName)).toEqual([
      "繁體中文",
      "简体中文",
      "English",
      "日本語",
      "한국어",
      "Tiếng Việt",
      "Português",
    ]);
  });
});

describe("K4 html lang", () => {
  it("每種語言都有合法的 lang 值", () => {
    expect(LOCALES.map((locale) => localeInfo[locale].htmlLang)).toEqual([
      "zh-Hant-TW",
      "zh-Hans-CN",
      "en",
      "ja",
      "ko",
      "vi",
      "pt-BR",
    ]);
  });
});

describe("格式化", () => {
  it("fmt 代入佔位符", () => {
    expect(fmt("第 {n} 站／{total}", { n: 2, total: 5 })).toBe("第 2 站／5");
    expect(fmt("{a} {missing}", { a: 1 })).toBe("1 {missing}");
  });

  it("數字、日期、誤差", () => {
    expect(formatNumber(4746, "zh-TW")).toBe("4,746");
    expect(formatNumber(4746, "pt")).toBe("4.746");
    expect(formatShortDate("2026-11-15", "zh-TW")).toBe("11/15");
    expect(formatError(0.42, "zh-TW")).toBe("42 cm");
    expect(formatError(-3.4, "zh-TW")).toBe("3.4 m");
    expect(formatError(3.4, "pt")).toBe("3,4 m");
  });
});
