import type { Metadata } from "next";
import { AdSlot } from "@/components/ads/AdSlot";
import { CatalogBrowser } from "@/components/catalog/CatalogBrowser";
import { Container } from "@/components/layout/Container";
import { PageHeading } from "@/components/layout/PageHeading";
import { getActiveCategories, getPublishedGames } from "@/lib/catalog/catalog";

export const metadata: Metadata = {
  title: "全部遊戲",
  description: "遊戲小站的完整遊戲目錄，可以用名稱搜尋，或依分類篩選。",
  alternates: { canonical: "/games" },
};

export default function GamesPage() {
  return (
    <Container className="py-10 sm:py-14">
      <PageHeading title="全部遊戲" lead="新上線的遊戲排在最前面。" />
      <div className="mt-8">
        <CatalogBrowser games={getPublishedGames()} categories={getActiveCategories()} />
      </div>
      <AdSlot slot="catalog-content" className="mt-16" />
    </Container>
  );
}
