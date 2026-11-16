import type { Metadata } from "next";
import { HomePage } from "@/components/pages/HomePage";
import { localeAlternates } from "@/lib/site-metadata";

export const metadata: Metadata = {
  alternates: localeAlternates("zh-TW", "/"),
};

export default function Page() {
  return <HomePage locale="zh-TW" />;
}
