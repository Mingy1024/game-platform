import { getDictionary } from "@/lib/i18n/dictionaries";
import { fmt, formatNumber } from "@/lib/i18n/format";
import { localePath, type Locale } from "@/lib/i18n/locales";
import { localeAlternates, type PageMeta } from "@/lib/site-metadata";
import { decodeRun } from "./share-code";

/** 遊戲頁的 SEO 資訊。繁體中文和其他語言的頁面共用。 */
const COVER = "/games/monk-soup-tower/0.1.0/hero.webp";

export function gameMetadata(locale: Locale, slug: string): PageMeta {
  const text = getDictionary(locale).monkSoupTower;
  const path = `/games/${slug}`;
  return {
    title: text.title,
    description: text.metaDescription,
    ...localeAlternates(locale, path),
    openGraph: {
      title: text.title,
      description: text.metaDescription,
      url: localePath(locale, path),
      images: [{ url: COVER }],
    },
  };
}

/** 成績連結的社群預覽：標題帶分數，圖片是成績圖。代碼無效時退回一般的遊戲頁資訊。 */
export function sharedMetadata(locale: Locale, slug: string, code: string): PageMeta {
  const base = gameMetadata(locale, slug);
  const run = decodeRun(code);
  if (!run) return { ...base, noindex: true };
  const text = getDictionary(locale).monkSoupTower;
  const title = fmt(text.share.text, { score: formatNumber(run.score, locale), grade: run.grade });
  const page = localePath(locale, `/games/${slug}/r/${code}`);
  const image = { url: `${page}/card`, width: 1080, height: 1350, alt: title };
  return {
    ...base,
    title,
    // 成績頁不需要被搜尋引擎收錄，正式頁面是遊戲介紹頁
    noindex: true,
    canonical: localePath(locale, `/games/${slug}`),
    languages: undefined,
    openGraph: { title, description: text.metaDescription, url: page, images: [image] },
    twitter: { card: "summary_large_image", title, images: [image.url] },
  };
}

/** 成績連結上方那一行朋友的分數；代碼無效時是 null */
export function sharedBanner(locale: Locale, code: string): string | null {
  const run = decodeRun(code);
  if (!run) return null;
  return fmt(getDictionary(locale).monkSoupTower.shared.banner, { score: formatNumber(run.score, locale) });
}
