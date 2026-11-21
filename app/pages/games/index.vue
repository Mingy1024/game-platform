<script setup lang="ts">
import { getActiveCategories, getPublishedGames } from "@/lib/catalog/catalog";

usePageMeta({
  title: "全部遊戲",
  description: "遊戲小站的完整遊戲目錄，可以用名稱搜尋，或依分類篩選。",
  canonical: "/games",
});
</script>

<template>
  <Container class="py-10 sm:py-14">
    <PageHeading title="全部遊戲" lead="新上線的遊戲排在最前面。" />
    <div class="mt-8">
      <CatalogBrowser :games="getPublishedGames()" :categories="getActiveCategories()" />
    </div>
    <AdSlot slot-id="catalog-content" class="mt-16" />
  </Container>
</template>
