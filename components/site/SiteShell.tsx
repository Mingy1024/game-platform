import type { ReactNode } from "react";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localeInfo, type Locale } from "@/lib/i18n/locales";

/**
 * 整個頁面的外框：<html>、頁首、主要內容、頁尾。
 * 繁體中文和其他語言各有自己的根版面，都用這個外框，差別只在語言和字型。
 */
export function SiteShell({
  locale,
  fontClass,
  fontFamily,
  children,
}: {
  locale: Locale;
  fontClass: string;
  /** 主要字型的 CSS 值；不給就用圓體 */
  fontFamily?: string;
  children: ReactNode;
}) {
  const dict = getDictionary(locale);
  return (
    <html
      lang={localeInfo[locale].htmlLang}
      className={`${fontClass} h-full antialiased`}
      style={fontFamily ? ({ "--font-locale": fontFamily } as React.CSSProperties) : undefined}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-sign focus:px-5 focus:py-3 focus:font-bold focus:text-white"
        >
          {dict.nav.skipToContent}
        </a>
        <Header locale={locale} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer locale={locale} />
      </body>
    </html>
  );
}
