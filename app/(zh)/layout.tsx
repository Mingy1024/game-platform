import type { Metadata, Viewport } from "next";
import { defaultFontClass } from "@/app/fonts";
import { SiteShell } from "@/components/site/SiteShell";
import { siteMetadata } from "@/lib/site-metadata";
import "../globals.css";

export const metadata: Metadata = siteMetadata("zh-TW");

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1d3a8f",
};

/** 繁體中文（預設語言）的根版面：網址不加語言前綴 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteShell locale="zh-TW" fontClass={defaultFontClass}>
      {children}
    </SiteShell>
  );
}
