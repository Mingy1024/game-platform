<script setup lang="ts">
import { getCategoriesOfGame } from "@/lib/catalog/catalog";
import type { HotEntry } from "@/lib/catalog/hot";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { localeInfo, localePath, type Locale } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/zh-TW";

/** 熱門榜（時刻表樣式） */
const {
  entries,
  labels = t.home,
  locale = "zh-TW",
  categoryLabels,
} = defineProps<{
  entries: HotEntry[];
  caption: string;
  /** 其他語言的首頁傳入翻譯後的文字 */
  labels?: Dictionary["home"];
  locale?: Locale;
  /** 分類 slug → 該語言的名稱；不給就用繁體中文 */
  categoryLabels?: Record<string, string>;
}>();

const live = computed(() => entries.some((entry) => entry.plays !== null));
const categoryText = (entry: HotEntry) =>
  getCategoriesOfGame(entry.game)
    .map((category) => categoryLabels?.[category.slug] ?? category.name)
    .join(locale.startsWith("zh") || locale === "ja" ? "、" : ", ");
</script>

<template>
  <div class="overflow-hidden rounded-2xl border border-line bg-card">
    <table class="w-full text-left">
      <caption class="sr-only">{{ caption }}</caption>
      <thead class="bg-sign text-white">
        <tr>
          <th scope="col" class="w-20 px-4 py-3 font-bold">{{ labels.hotRank }}</th>
          <th scope="col" class="px-4 py-3 font-bold">{{ labels.hotGame }}</th>
          <th scope="col" class="hidden px-4 py-3 font-bold sm:table-cell">{{ labels.hotCategory }}</th>
          <th scope="col" class="px-4 py-3 text-right font-bold">{{ labels.hotPlays }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(entry, index) in entries" :key="entry.game.id" class="border-t border-line">
          <td class="px-4 py-3 text-xl font-black tabular-nums text-sign">{{ live ? index + 1 : "—" }}</td>
          <td class="px-4 py-3">
            <NuxtLink
              :to="localePath(locale, `/games/${entry.game.slug}`)"
              class="-my-2 flex min-h-11 items-center font-bold text-ink underline-offset-4 hover:underline"
            >
              {{ entry.game.title }}
            </NuxtLink>
          </td>
          <td class="hidden px-4 py-3 text-muted sm:table-cell">{{ categoryText(entry) }}</td>
          <td class="px-4 py-3 text-right font-bold tabular-nums">
            {{ entry.plays === null ? "—" : entry.plays.toLocaleString(localeInfo[locale].intl) }}
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="!live" class="border-t border-line px-4 py-3 text-sm text-muted" data-testid="hot-not-live">
      <strong class="text-ink">{{ labels.hotEmptyTitle }}</strong>{{ "\u3000" }}{{ labels.hotEmptyBody }}
    </p>
  </div>
</template>
