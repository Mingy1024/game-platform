<script setup lang="ts">
import { categories } from "@/lib/catalog/categories";
import type { GameManifest } from "@/lib/catalog/schema";
import { localePath, type Locale } from "@/lib/i18n/locales";

/**
 * 車票卡：左邊是封面（票根），右邊是遊戲資訊，中間有打孔線與缺口。
 * 整張卡是一個連結，焦點外框畫在外層，不會被缺口遮罩切掉。
 */
const {
  game,
  headingLevel = "h3",
  locale = "zh-TW",
  categoryLabels,
} = defineProps<{
  game: GameManifest;
  headingLevel?: "h2" | "h3";
  locale?: Locale;
  /** 分類 slug → 該語言的名稱；不給就用繁體中文 */
  categoryLabels?: Record<string, string>;
}>();

const categoryNames = computed(() =>
  categories
    .filter((category) => game.categories.includes(category.slug))
    .map((category) => categoryLabels?.[category.slug] ?? category.name),
);
</script>

<template>
  <NuxtLink :to="localePath(locale, `/games/${game.slug}`)" class="ticket-wrap block h-full rounded-[14px]">
    <article class="ticket flex h-full min-h-32">
      <GameCover :game="game" class="w-28 shrink-0 self-stretch" />
      <div class="flex min-w-0 flex-1 flex-col border-l-2 border-dashed border-line px-4 py-3">
        <component :is="headingLevel" class="text-lg font-extrabold text-ink">{{ game.title }}</component>
        <p class="mt-0.5 text-sm text-muted">{{ game.summary }}</p>
        <ul class="mt-auto flex flex-wrap gap-1.5 pt-3">
          <li
            v-for="name in categoryNames"
            :key="name"
            class="rounded-full bg-sign-tint px-2.5 py-0.5 text-sm font-semibold text-sign"
          >
            {{ name }}
          </li>
          <li
            v-for="tag in game.tags.slice(0, 1)"
            :key="tag"
            class="rounded-full px-2.5 py-0.5 text-sm text-muted ring-1 ring-inset ring-line"
          >
            {{ tag }}
          </li>
        </ul>
      </div>
    </article>
  </NuxtLink>
</template>
