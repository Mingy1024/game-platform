import type { Metadata } from "next";
import { Suspense } from "react";
import { PreciseStopPage } from "@/components/precise-stop/PreciseStopPage";
import { getPublishedGames } from "@/lib/catalog/catalog";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { fmt, formatNumber } from "@/lib/i18n/format";
import { localePath, type Locale } from "@/lib/i18n/locales";
import { localeAlternates } from "@/lib/site-metadata";
import { decodeRun } from "./share-code";

/**
 * 遊戲頁共用的部分。繁體中文（app/(zh)）和其他語言（app/[locale]）各有自己的路由檔，
 * 內容都從這裡來。目前目錄只有精準停車一款。
 */
export const gameSlugs = () => getPublishedGames().map((game) => game.slug);

const COVER = "/games/precise-stop/0.1.0/hero.webp";

export function gameMetadata(locale: Locale, slug: string): Metadata {
  const text = getDictionary(locale).preciseStop;
  const path = `/games/${slug}`;
  return {
    title: text.title,
    description: text.metaDescription,
    alternates: localeAlternates(locale, path),
    openGraph: {
      title: text.title,
      description: text.metaDescription,
      url: localePath(locale, path),
      images: [COVER],
    },
  };
}

export function GamePage({ locale }: { locale: Locale }) {
  return <PreciseStopPage locale={locale} />;
}

/** 成績連結的社群預覽：標題帶分數，圖片是成績圖。代碼無效時退回一般的遊戲頁資訊。 */
export function sharedMetadata(locale: Locale, slug: string, code: string): Metadata {
  const base = gameMetadata(locale, slug);
  const run = decodeRun(code);
  if (!run) return { ...base, robots: { index: false } };
  const text = getDictionary(locale).preciseStop;
  const title = fmt(text.share.text, { score: formatNumber(run.total, locale) });
  const page = localePath(locale, `/games/${slug}/r/${code}`);
  const image = { url: `${page}/card`, width: 1080, height: 1350, alt: title };
  return {
    ...base,
    title,
    // 成績頁不需要被搜尋引擎收錄，正式頁面是遊戲介紹頁
    robots: { index: false },
    alternates: { canonical: localePath(locale, `/games/${slug}`) },
    openGraph: { title, description: text.metaDescription, url: page, images: [image] },
    twitter: { card: "summary_large_image", title, images: [image.url] },
  };
}

async function SharedBanner({ locale, code }: { locale: Locale; code: Promise<string> }) {
  const run = decodeRun(await code);
  if (!run) return null;
  return (
    <p
      data-testid="shared-banner"
      className="mt-4 rounded-xl border border-edge bg-edge-tint px-4 py-3 font-bold text-ink"
    >
      {fmt(getDictionary(locale).preciseStop.shared.banner, { score: formatNumber(run.total, locale) })}
    </p>
  );
}

/**
 * 成績連結的頁面：和介紹頁一樣，多一行朋友的分數。
 * 只有這一行要等網址上的代碼，其餘內容和介紹頁共用同一份。
 */
export function SharedPage({ locale, code }: { locale: Locale; code: Promise<string> }) {
  return (
    <PreciseStopPage
      locale={locale}
      banner={
        <Suspense fallback={null}>
          <SharedBanner locale={locale} code={code} />
        </Suspense>
      }
    />
  );
}
