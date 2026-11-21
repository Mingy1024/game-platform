<script setup lang="ts">
import { getActiveCategories, getFeaturedGame, getPublishedGames } from "@/lib/catalog/catalog";
import { withoutStats } from "@/lib/catalog/hot";
import { localizeCategory, localizeGame } from "@/lib/catalog/localize";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";

/** 首頁。繁體中文和其他語言共用，只差在文字。 */
const { locale } = defineProps<{ locale: Locale }>();

const moreLink = "flex min-h-11 items-center font-bold text-sign underline-offset-4 hover:underline";

const dict = computed(() => getDictionary(locale));
const games = computed(() => getPublishedGames().map((game) => localizeGame(game, dict.value)));
const featuredSlug = getFeaturedGame()?.slug;
const featured = computed(() => games.value.find((game) => game.slug === featuredSlug));
const others = computed(() => games.value.filter((game) => game.slug !== featuredSlug));
// 站名牌兩側：上一站、下一站各放一款其他遊戲
const previous = computed(() => others.value.at(-1));
const next = computed(() => (others.value.length > 1 ? others.value[0] : undefined));
const categories = computed(() => getActiveCategories().map((category) => localizeCategory(category, dict.value)));
const categoryLabels = computed(() => Object.fromEntries(categories.value.map((item) => [item.slug, item.name])));
// 依標點分段，窄螢幕換行時不會把詞切開
const taglineParts = computed(() => dict.value.tagline.split(/(?<=[，、,:：])/));
</script>

<template>
  <Container class="py-8 sm:py-12">
    <h1 class="text-2xl font-extrabold text-sign sm:text-3xl">
      <span v-for="part in taglineParts" :key="part" class="inline-block whitespace-pre-wrap">{{ part }}</span>
    </h1>
    <p class="mt-2 max-w-xl text-lg text-muted">{{ dict.home.lead }}</p>

    <div v-if="featured" class="mt-8">
      <StationSign :game="featured" :previous="previous" :next="next" :locale="locale" :dict="dict" />
    </div>

    <section aria-labelledby="categories-title" class="mt-14">
      <SectionHeading id="categories-title" :title="dict.home.categoriesTitle" />
      <CategoryNav :categories="categories" />
    </section>

    <section aria-labelledby="latest-title" class="mt-14">
      <SectionHeading id="latest-title" :title="dict.home.latestTitle">
        <template #action>
          <NuxtLink to="/games" :class="moreLink">{{ dict.actions.allGames }}</NuxtLink>
        </template>
      </SectionHeading>
      <GameGrid :games="games.slice(0, 6)" :locale="locale" :category-labels="categoryLabels" />
    </section>

    <AdSlot slot-id="home-content" class="mt-16" :label="dict.ads.label" :mock-text="dict.ads.mock" />

    <section aria-labelledby="hot-title" class="mt-16">
      <SectionHeading id="hot-title" :title="dict.home.hotTitle">
        <template #action>
          <NuxtLink to="/hot" :class="moreLink">{{ dict.home.hotMore }}</NuxtLink>
        </template>
      </SectionHeading>
      <HotTable
        :entries="withoutStats(games)"
        :caption="dict.home.hotCaption"
        :labels="dict.home"
        :locale="locale"
        :category-labels="categoryLabels"
      />
    </section>

    <div class="mt-12 text-center">
      <ButtonLink href="/games" variant="secondary" size="lg">{{ dict.actions.allGames }}</ButtonLink>
    </div>
  </Container>
</template>
