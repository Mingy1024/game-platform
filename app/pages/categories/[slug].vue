<script setup lang="ts">
import { getActiveCategories, getGamesByCategory } from "@/lib/catalog/catalog";
import { getCategoryBySlug } from "@/lib/catalog/categories";

// 不存在或沒有遊戲的分類都回 404，不建立空分類頁
definePageMeta({
  validate: (route) => getActiveCategories().some((category) => category.slug === route.params.slug),
});

const route = useRoute();
const category = computed(() => getCategoryBySlug(String(route.params.slug))!);
const games = computed(() => getGamesByCategory(category.value.slug));
usePageMeta(() => ({
  title: `${category.value.name}遊戲`,
  description: category.value.intro,
  canonical: `/categories/${category.value.slug}`,
}));
</script>

<template>
  <Container class="py-6 sm:py-10">
    <Breadcrumb :items="[{ label: '首頁', href: '/' }, { label: '全部遊戲', href: '/games' }, { label: category.name }]" />
    <div class="mt-2">
      <PageHeading :title="`${category.name}遊戲`" :lead="category.intro" />
    </div>

    <div class="mt-8">
      <GameGrid :games="games" heading-level="h2" />
    </div>

    <section aria-labelledby="other-categories-title" class="mt-16">
      <SectionHeading id="other-categories-title" title="其他分類" />
      <CategoryNav :categories="getActiveCategories()" :current-slug="category.slug" />
    </section>
  </Container>
</template>
