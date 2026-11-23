<script setup lang="ts">
import { BOARD_ID, useExperience } from "~/games/mine-descent/shared";
import { ZONES } from "@/lib/games/mine-descent/config";
import { fmt, formatNumber } from "@/lib/i18n/format";

/**
 * 出發看板：一顆「開始逃生」鈕，加上最深紀錄、最高分和五段深度。
 * 手機往下捲、看板離開畫面後，底部出現固定的出發列。
 */
const { text, locale, start } = useExperience();
const records = useMineRecords();
const stickyVisible = ref(false);
const board = useTemplateRef<HTMLElement>("board");

let observer: IntersectionObserver | undefined;
onMounted(() => {
  if (!board.value) return;
  observer = new IntersectionObserver(
    ([entry]) => {
      if (entry) stickyVisible.value = !entry.isIntersecting && entry.boundingClientRect.bottom < 0;
    },
    { threshold: 0 },
  );
  observer.observe(board.value);
});
onBeforeUnmount(() => observer?.disconnect());

const number = (value: number | null) => (value === null ? "—" : formatNumber(value, locale));
const depth = computed(() => number(records.value.depth));
const score = computed(() => number(records.value.score));
</script>

<template>
  <section
    :id="BOARD_ID"
    ref="board"
    aria-labelledby="board-title"
    data-testid="departure-board"
    class="on-dark flex flex-col gap-3 rounded-[20px] bg-[#2a1710] p-3.5 text-white shadow-[inset_0_0_0_3px_#b9803f] sm:p-[18px]"
  >
    <div class="flex items-center justify-between gap-3">
      <h2 id="board-title" class="flex items-center gap-2 text-lg font-extrabold sm:text-xl">
        <span class="size-2.5 rounded-full bg-[#ffd23f] shadow-[0_0_8px_#ffd23f]" aria-hidden="true" />
        {{ text.board.title }}
      </h2>
    </div>
    <p class="text-sm text-[#e8d4a0]">{{ text.board.subtitle }}</p>

    <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-[#6b2f1a] px-3.5 py-3 lg:px-4">
      <dl class="grid grid-cols-2 gap-3">
        <div>
          <dt class="text-xs font-bold text-[#e8d4a0]">{{ text.board.bestDepth }}</dt>
          <dd class="text-2xl font-extrabold tabular-nums text-[#ffd23f]" data-testid="best-depth">
            {{ depth }}<span v-if="records.depth !== null" class="ml-1 text-sm">{{ text.hud.unit }}</span>
          </dd>
        </div>
        <div>
          <dt class="text-xs font-bold text-[#e8d4a0]">{{ text.board.bestScore }}</dt>
          <dd class="text-2xl font-extrabold tabular-nums text-[#ffd23f]" data-testid="best-score">{{ score }}</dd>
        </div>
      </dl>
      <button
        type="button"
        :aria-label="text.board.departAria"
        data-testid="depart-button"
        class="press flex min-h-13 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl bg-[#ffd23f] px-5 text-lg font-extrabold text-[#1a120c] shadow-[0_4px_0_#b8860b]"
        @click="start"
      >
        {{ text.board.depart }}
        <Icon name="play" :size="14" class="fill-current" />
      </button>
    </div>

    <div class="rounded-2xl bg-black/[0.22] px-3 pb-3 pt-3">
      <p class="mb-2 text-sm font-bold text-[#e8d4a0]">{{ text.board.zonesTitle }}</p>
      <ol class="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <li v-for="(zone, index) in text.zones" :key="zone.name" class="flex flex-col rounded-xl bg-white/[0.06] px-3 py-2" data-testid="zone">
          <span class="text-xs font-bold tabular-nums text-[#e8d4a0]">{{ fmt(text.board.fromMeters, { count: formatNumber(ZONES[index].from, locale) }) }}</span>
          <span class="font-extrabold leading-snug">{{ zone.name }}</span>
          <span class="text-sm text-[#e8d4a0]">{{ zone.hint }}</span>
        </li>
      </ol>
    </div>
  </section>

  <div
    data-testid="sticky-depart"
    :hidden="!stickyVisible"
    class="fixed inset-x-0 bottom-0 z-30 flex gap-2 bg-card/95 px-3 pb-3.5 pt-2.5 shadow-[0_-6px_18px_rgb(16_19_26/0.12)] lg:hidden"
  >
    <button type="button" class="press min-h-13 flex-1 cursor-pointer rounded-2xl bg-[#ffd23f] px-2 text-lg font-extrabold text-[#1a120c] shadow-[0_4px_0_#b8860b]" @click="start">
      {{ text.board.depart }}
    </button>
  </div>
</template>
