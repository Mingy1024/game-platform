<script setup lang="ts">
import { getDictionary } from "@/lib/i18n/dictionaries";
import { fmt, formatNumber } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/locales";
import { shouldShowPlayCount } from "@/lib/play-count";
import { fetchPlayCount } from "@/lib/play-count/client";

/**
 * 遊戲介紹頁的累計遊玩次數（所有玩家加總，docs/plans/play-count.md）。
 * 功能開關 FEATURE_PLAY_COUNT 打開、而且讀到的次數至少 100 才顯示；讀取失敗就不顯示。
 * 數字在瀏覽器讀（預先產生的頁面不帶數字），所以畫面先沒有，讀到後才出現。
 */
const { slug, locale } = defineProps<{ slug: string; locale: Locale }>();
const enabled = useFlag("playCount");
const count = ref<number | null>(null);

onMounted(async () => {
  if (!enabled.value) return;
  count.value = await fetchPlayCount(slug);
});

const template = computed(() => getDictionary(locale).playCount);
const parts = computed(() => {
  const [before, after = ""] = template.value.split("{count}");
  return { before, after };
});
const formatted = computed(() => (count.value === null ? "" : formatNumber(count.value, locale)));
</script>

<template>
  <span
    v-if="enabled && shouldShowPlayCount(count)"
    data-testid="play-count"
    :title="fmt(template, { count: formatted })"
    class="inline-flex items-center gap-2 whitespace-nowrap rounded-full border-2 border-line bg-card py-1 pl-1 pr-3 text-sm font-bold"
  >
    <span class="flex size-7 items-center justify-center rounded-full bg-express text-white">
      <Icon name="play" :size="16" />
    </span>
    <span>{{ parts.before }}<strong class="text-base tabular-nums text-express">{{ formatted }}</strong>{{ parts.after }}</span>
  </span>
</template>
