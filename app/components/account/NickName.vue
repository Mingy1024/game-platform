<script setup lang="ts">
import { nickParts, type Nick } from "@/lib/account/nick/nick";
import type { Locale } from "@/lib/i18n/locales";

/**
 * 依語言顯示暱稱。隨機暱稱的四位數用灰色等寬數字，和名字分開；自訂暱稱沒有四位數。
 * 排行榜、結算卡、帳號卡共用。
 */
const { nick, locale, numberClass = "" } = defineProps<{ nick: Nick; locale: Locale; numberClass?: string }>();
const parts = computed(() => nickParts(nick, locale));
</script>

<template>
  <span data-testid="nick-name"><strong class="font-black">{{ parts.name }}</strong><template v-if="parts.number">{{ " " }}<span :class="`font-bold tabular-nums text-muted ${numberClass}`">{{ parts.number }}</span></template></span>
</template>
