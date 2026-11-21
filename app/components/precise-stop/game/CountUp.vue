<script setup lang="ts">
import { formatNumber } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/locales";

/** 總分從 0 跑到最終分數，約 1.2 秒；系統要求減少動態時直接顯示 */
const { value, locale } = defineProps<{ value: number; locale: Locale }>();
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const shown = ref(reduced() ? value : 0);
let frame = 0;

watch(
  () => value,
  (target) => {
    cancelAnimationFrame(frame);
    if (reduced()) {
      shown.value = target;
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1200);
      shown.value = Math.round(target * (1 - (1 - t) ** 3));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  },
  { immediate: true },
);
onBeforeUnmount(() => cancelAnimationFrame(frame));
</script>

<template>{{ formatNumber(shown, locale) }}</template>
