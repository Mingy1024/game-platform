import { getDictionary } from "@/lib/i18n/dictionaries";
import { LOCALES, localeInfo, localePath, type Locale } from "@/lib/i18n/locales";

/** 正式網址（建置時由 SITE_URL 決定），canonical、hreflang、社群預覽的絕對網址都用它 */
export const SITE_URL = process.env.SITE_URL ?? "http://localhost:3000";

/**
 * 測試站（例如 *.workers.dev）不要被搜尋引擎收錄：建置時設 SITE_NOINDEX=1，
 * 全站加 noindex、robots.txt 禁止爬取。正式站不要設。
 */
export const SITE_NOINDEX = process.env.SITE_NOINDEX === "1";

/** robots.txt 的內容；noindex 為真時禁止全部爬取，否則全部允許 */
export const robotsTxt = (noindex: boolean) =>
  noindex ? "User-agent: *\nDisallow: /\n" : "User-agent: *\nAllow: /\n";

export const absoluteUrl = (path: string) => new URL(path, SITE_URL).toString();

/**
 * 一頁的 SEO 資訊（和框架無關的資料）。由 app/composables/seo.ts 轉成 <head> 內容，
 * 網址都是站內路徑，輸出時才換成絕對網址。
 */
export type PageMeta = {
  /** 套用「%s｜網站名稱」樣板；沒給就用網站預設標題 */
  title?: string;
  description?: string;
  canonical?: string;
  /** hreflang → 路徑 */
  languages?: Record<string, string>;
  noindex?: boolean;
  openGraph?: {
    title: string;
    description: string;
    url: string;
    images: { url: string; width?: number; height?: number; alt?: string }[];
  };
  twitter?: TwitterMeta;
};

export type TwitterMeta = { card: "summary" | "summary_large_image"; title: string; description?: string; images: string[] };

/**
 * 實際輸出的 Twitter 卡片：和原本的 Next.js 一樣，沒有指定時從 Open Graph 補齊
 * （有圖片用大圖卡片），描述沒指定時沿用 Open Graph 的描述。
 */
export function resolveTwitter(meta: PageMeta): TwitterMeta | undefined {
  const og = meta.openGraph;
  if (meta.twitter) return { ...meta.twitter, description: meta.twitter.description ?? og?.description };
  if (!og) return undefined;
  return {
    card: og.images.length ? "summary_large_image" : "summary",
    title: og.title,
    description: og.description,
    images: og.images.map((image) => image.url),
  };
}

/** 網站名稱與預設標題、描述 */
export function siteMetadata(locale: Locale) {
  const dict = getDictionary(locale);
  return {
    defaultTitle: `${dict.brand}｜${dict.tagline}`,
    titleTemplate: `%s｜${dict.brand}`,
    description: dict.description,
  };
}

/**
 * 有翻譯的頁面要標出每個語言版本的網址（hreflang），
 * path 是不含語言前綴的路徑，例如 /games/precise-stop。
 */
export function localeAlternates(locale: Locale, path: string): Pick<PageMeta, "canonical" | "languages"> {
  const languages: Record<string, string> = {};
  for (const item of LOCALES) languages[localeInfo[item].htmlLang] = localePath(item, path);
  languages["x-default"] = localePath("zh-TW", path);
  return { canonical: localePath(locale, path), languages };
}
