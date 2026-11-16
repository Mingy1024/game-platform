import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { localeFontClass, localeFontFamily } from "@/app/locale-fonts";
import { SiteShell } from "@/components/site/SiteShell";
import { PREFIXED_LOCALES, localeFromPrefix, localeInfo } from "@/lib/i18n/locales";
import { siteMetadata } from "@/lib/site-metadata";
import "../globals.css";

export function generateStaticParams() {
  return PREFIXED_LOCALES.map((locale) => ({ locale: localeInfo[locale].prefix }));
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = localeFromPrefix(await rootLocale());
  return locale ? siteMetadata(locale) : {};
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1d3a8f",
};

/** 其他語言的根版面：網址第一段是語言前綴（/en、/ja……） */
export default async function LocaleLayout({ children }: { children: React.ReactNode }) {
  const locale = localeFromPrefix(await rootLocale());
  // 不是語言前綴的網址由 proxy.ts 擋掉，這裡是最後一道保險
  if (!locale) notFound();
  return (
    <SiteShell locale={locale} fontClass={localeFontClass} fontFamily={localeFontFamily(locale)}>
      {children}
    </SiteShell>
  );
}
