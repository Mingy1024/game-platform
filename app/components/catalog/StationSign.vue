<script setup lang="ts">
import type { GameManifest } from "@/lib/catalog/schema";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { localePath, type Locale } from "@/lib/i18n/locales";

/**
 * 站名牌：首頁的主推遊戲。
 * 上半是站名（遊戲名稱）與開始按鈕，下半的藍色色帶標出上一站與下一站（另外兩款遊戲）。
 */
const { game, locale } = defineProps<{
  game: GameManifest;
  previous?: GameManifest;
  next?: GameManifest;
  locale: Locale;
  dict: Dictionary;
}>();

// 預覽圖在第一屏：優先下載
useHead({ link: [{ rel: "preload", as: "image", href: game.hero, fetchpriority: "high" }] });
const href = computed(() => localePath(locale, `/games/${game.slug}`));
// 漢字站名拉開字距，其他文字維持正常字距
const spaced = computed(() => /^[㐀-鿿]+$/.test(game.title));
</script>

<template>
  <section aria-labelledby="featured-title" class="overflow-hidden rounded-sign border-4 border-sign bg-card">
    <div class="md:grid md:grid-cols-[2fr_3fr]">
      <!-- 預覽圖：手機在上方、電腦在左側。旁邊就有標題與開始鈕，所以圖片連結不進鍵盤順序、alt 留空 -->
      <NuxtLink
        :to="href"
        tabindex="-1"
        aria-hidden="true"
        class="relative block aspect-[4/3] overflow-hidden border-b-4 border-sign md:aspect-auto md:min-h-80 md:border-b-0 md:border-r-4"
      >
        <img
          :src="game.hero"
          alt=""
          fetchpriority="high"
          class="absolute inset-0 size-full object-cover object-[50%_58%] transition-transform duration-500 hover:scale-105 motion-reduce:transition-none motion-reduce:hover:scale-100"
        >
      </NuxtLink>
      <div class="flex flex-col items-center justify-center px-5 pb-8 pt-8 text-center sm:pb-10 sm:pt-12">
        <p class="font-semibold text-muted">{{ dict.home.featured }}</p>
        <h2
          id="featured-title"
          :class="`mt-1 text-3xl font-black text-ink sm:text-4xl ${spaced ? 'pl-[0.25em] tracking-[0.25em]' : ''}`"
        >
          {{ game.title }}
        </h2>
        <p class="mx-auto mt-3 max-w-md text-lg text-muted">{{ game.summary }}</p>
        <ButtonLink :href="href" size="lg" class="mt-6">{{ dict.actions.play }}</ButtonLink>
      </div>
    </div>

    <div class="on-dark flex items-stretch bg-sign text-white">
      <StationNeighbour :game="previous" direction="previous" :locale="locale" :dict="dict" />
      <div aria-hidden="true" class="flex min-w-10 flex-1 items-center">
        <span class="h-1 flex-1 bg-white/70" />
        <span class="size-4 shrink-0 rounded-full bg-edge ring-4 ring-white" />
        <span class="h-1 flex-1 bg-white/70" />
      </div>
      <StationNeighbour :game="next" direction="next" :locale="locale" :dict="dict" />
    </div>
  </section>
</template>
