import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { HomePage } from "@/components/pages/HomePage";
import { localeFromPrefix } from "@/lib/i18n/locales";
import { localeAlternates } from "@/lib/site-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const locale = localeFromPrefix(await rootLocale());
  return locale ? { alternates: localeAlternates(locale, "/") } : {};
}

export default async function Page() {
  const locale = localeFromPrefix(await rootLocale());
  if (!locale) notFound();
  return <HomePage locale={locale} />;
}
