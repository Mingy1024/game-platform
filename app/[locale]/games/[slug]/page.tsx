import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { GamePage, gameMetadata, gameSlugs } from "@/lib/games/precise-stop/game-page";
import { PREFIXED_LOCALES, localeFromPrefix, localeInfo } from "@/lib/i18n/locales";

export function generateStaticParams() {
  return PREFIXED_LOCALES.flatMap((locale) =>
    gameSlugs().map((slug) => ({ locale: localeInfo[locale].prefix, slug })),
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = localeFromPrefix(await rootLocale());
  return locale ? gameMetadata(locale, "precise-stop") : {};
}

/** 語言從根參數讀取；不存在的遊戲網址由 proxy.ts 回 404 */
export default async function Page() {
  const locale = localeFromPrefix(await rootLocale());
  if (!locale) notFound();
  return <GamePage locale={locale} />;
}
