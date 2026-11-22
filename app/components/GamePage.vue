<script setup lang="ts">
import { gameMetadata as officeEscapeMetadata } from "@/lib/games/office-escape/meta";
import { gameMetadata as preciseStopMetadata } from "@/lib/games/precise-stop/meta";
import type { Locale } from "@/lib/i18n/locales";

/** 遊戲介紹頁。依 slug 分派到各款遊戲，所有語言共用。 */
const { locale, slug } = defineProps<{ locale: Locale; slug: string }>();
usePageMeta(slug === "office-escape" ? officeEscapeMetadata(locale, slug) : preciseStopMetadata(locale, slug));
</script>

<template>
  <OfficeEscapePage v-if="slug === 'office-escape'" :locale="locale" />
  <PreciseStopPage v-else :locale="locale" />
</template>
