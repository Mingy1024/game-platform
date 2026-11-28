<script setup lang="ts">
import { gameMetadata as mineDescentMetadata } from "@/lib/games/mine-descent/meta";
import { gameMetadata as monkSoupTowerMetadata } from "@/lib/games/monk-soup-tower/meta";
import { gameMetadata as officeEscapeMetadata } from "@/lib/games/office-escape/meta";
import { gameMetadata as preciseStopMetadata } from "@/lib/games/precise-stop/meta";
import type { Locale } from "@/lib/i18n/locales";

/** 遊戲介紹頁。依 slug 分派到各款遊戲，所有語言共用。 */
const { locale, slug } = defineProps<{ locale: Locale; slug: string }>();
usePageMeta(
  slug === "monk-soup-tower"
    ? monkSoupTowerMetadata(locale, slug)
    : slug === "mine-descent"
      ? mineDescentMetadata(locale, slug)
      : slug === "office-escape" ? officeEscapeMetadata(locale, slug) : preciseStopMetadata(locale, slug),
);
</script>

<template>
  <MonkSoupTowerPage v-if="slug === 'monk-soup-tower'" :locale="locale" />
  <MineDescentPage v-else-if="slug === 'mine-descent'" :locale="locale" />
  <OfficeEscapePage v-else-if="slug === 'office-escape'" :locale="locale" />
  <PreciseStopPage v-else :locale="locale" />
</template>
