import type { Metadata, Viewport } from "next";
import { Chiron_GoRound_TC } from "next/font/google";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { t } from "@/lib/i18n/zh-TW";
import "./globals.css";

/* 圓體呼應站名牌。中文字型檔很大，不預載，交給 unicode-range 按需下載。 */
const round = Chiron_GoRound_TC({
  variable: "--font-round",
  subsets: ["latin"],
  display: "swap",
  preload: false,
  // next/font 沒有這個字型的度量資料，無法產生對應的備用字型
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: {
    default: `${t.brand}｜${t.tagline}`,
    template: `%s｜${t.brand}`,
  },
  description: t.description,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1d3a8f",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant-TW" className={`${round.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-sign focus:px-5 focus:py-3 focus:font-bold focus:text-white"
        >
          {t.nav.skipToContent}
        </a>
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
