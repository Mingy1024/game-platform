<script setup lang="ts">
import type { GameManifest } from "@/lib/catalog/schema";
import type { Locale } from "@/lib/i18n/locales";

/** 遊戲網格：手機 1 欄、平板 2 欄、桌面 3 欄。 */
defineProps<{
  games: GameManifest[];
  headingLevel?: "h2" | "h3";
  locale?: Locale;
  categoryLabels?: Record<string, string>;
}>();
</script>

<template>
  <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
    <li v-for="game in games" :key="game.id">
      <GameCard :game="game" :heading-level="headingLevel" :locale="locale" :category-labels="categoryLabels" />
    </li>
  </ul>
</template>
