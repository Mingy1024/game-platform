<script setup lang="ts">
import { gameMetadata } from "@/lib/games/precise-stop/meta";
import type { Locale } from "@/lib/i18n/locales";

/** 遊戲介紹頁。目前目錄只有精準停車一款，所有語言共用。 */
const { locale, slug } = defineProps<{ locale: Locale; slug: string }>();
usePageMeta(gameMetadata(locale, slug));
</script>

<template>
  <PreciseStopPage :locale="locale" />
</template>
