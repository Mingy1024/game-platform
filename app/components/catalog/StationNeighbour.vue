<script setup lang="ts">
import type { GameManifest } from "@/lib/catalog/schema";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { localePath, type Locale } from "@/lib/i18n/locales";

/** 站名牌下緣的上一站／下一站 */
const { direction } = defineProps<{
  game?: GameManifest;
  direction: "previous" | "next";
  locale: Locale;
  dict: Dictionary;
}>();
const isNext = computed(() => direction === "next");
</script>

<template>
  <div v-if="!game" class="w-28 sm:w-44" />
  <NuxtLink
    v-else
    :to="localePath(locale, `/games/${game.slug}`)"
    :class="`flex min-h-16 items-center gap-1 px-3 py-2 hover:bg-sign-deep sm:gap-2 sm:px-5 ${
      isNext ? 'flex-row-reverse text-right' : ''
    }`"
  >
    <Icon :name="isNext ? 'right' : 'left'" />
    <span class="flex flex-col leading-tight">
      <span class="text-sm text-white/85">{{ isNext ? dict.home.next : dict.home.previous }}</span>
      <span class="font-bold sm:text-lg">{{ game.title }}</span>
    </span>
  </NuxtLink>
</template>
