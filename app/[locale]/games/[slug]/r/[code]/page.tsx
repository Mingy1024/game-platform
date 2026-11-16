import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { SharedPage, sharedMetadata } from "@/lib/games/precise-stop/game-page";
import { localeFromPrefix } from "@/lib/i18n/locales";

type Props = { params: Promise<{ locale: string; slug: string; code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: prefix, slug, code } = await params;
  const locale = localeFromPrefix(prefix);
  return locale ? sharedMetadata(locale, slug, code) : {};
}

export default async function Page({ params }: Props) {
  const locale = localeFromPrefix(await rootLocale());
  if (!locale) notFound();
  return <SharedPage locale={locale} code={params.then((value) => value.code)} />;
}
