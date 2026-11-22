<script setup lang="ts">
import { BOARD_ID, useExperience } from "~/games/office-escape/shared";
import { SEGMENTS } from "@/lib/games/office-escape/config";
import { todayBest } from "@/lib/games/office-escape/records";
import { fmt, formatFullDate, formatNumber } from "@/lib/i18n/format";
import { taiwanDateKey } from "@/lib/games/office-escape/route";

/**
 * 打卡鐘（出發看板）：一顆「下班！」出發鈕，加上今日最佳、歷史最佳和四段路線。
 * 路線是固定的，所以和日期無關；今日最佳依台灣日期，在瀏覽器端算。
 */
const { text, locale, start } = useExperience();
const records = useEscapeRecords();
const todayKey = useClientValue(taiwanDateKey);
const stickyVisible = ref(false);
const board = useTemplateRef<HTMLElement>("board");

// 手機往下捲、看板離開畫面後，底部出現固定的出發列
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
const today = computed(() => number(todayBest(records.value)));
const best = computed(() => number(records.value.best));
</script>

<template>
  <section
    :id="BOARD_ID"
    ref="board"
    aria-labelledby="board-title"
    data-testid="departure-board"
    class="on-dark flex flex-col gap-3 rounded-[20px] bg-sign-deep p-3.5 text-white shadow-[inset_0_0_0_3px_var(--sign)] sm:p-[18px]"
  >
    <div class="flex items-center justify-between gap-3">
      <h2 id="board-title" class="flex items-center gap-2 text-lg font-extrabold sm:text-xl">
        <span class="size-2.5 rounded-full bg-[#4fd69c] shadow-[0_0_8px_#4fd69c]" aria-hidden="true" />
        {{ text.board.title }}
      </h2>
      <span class="text-sm font-bold tabular-nums text-[#c9cfd8]">{{ todayKey ? formatFullDate(todayKey, locale) : "" }}</span>
    </div>
    <p class="text-sm text-[#c9cfd8]">{{ text.board.subtitle }}</p>

    <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-sign px-3.5 py-3 lg:px-4">
      <dl class="grid grid-cols-2 gap-3">
        <div>
          <dt class="text-xs font-bold text-[#c9cfd8]">{{ text.board.today }}</dt>
          <dd class="text-2xl font-extrabold tabular-nums text-edge" data-testid="best-daily">{{ today }}</dd>
        </div>
        <div>
          <dt class="text-xs font-bold text-[#c9cfd8]">{{ text.board.best }}</dt>
          <dd class="text-2xl font-extrabold tabular-nums text-edge" data-testid="best-all">{{ best }}</dd>
        </div>
      </dl>
      <button
        type="button"
        :aria-label="text.board.departAria"
        data-testid="depart-button"
        class="press flex min-h-13 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl bg-express px-5 text-lg font-extrabold text-white shadow-[0_4px_0_var(--express-deep)]"
        @click="start"
      >
        {{ text.board.depart }}
        <Icon name="play" :size="14" class="fill-current" />
      </button>
    </div>

    <div class="rounded-2xl bg-black/[0.22] px-3 pb-3 pt-3">
      <p class="mb-2 text-sm font-bold text-[#8fa0c8]">{{ text.board.routeTitle }}</p>
      <ol class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <li v-for="(segment, index) in text.segments" :key="segment.name" class="flex flex-col rounded-xl bg-white/[0.06] px-3 py-2" data-testid="route-segment">
          <span class="text-xs font-bold text-[#8fa0c8]">{{ index + 1 }}／{{ SEGMENTS.length }}</span>
          <span class="font-extrabold leading-snug">{{ segment.name }}</span>
          <span class="text-sm tabular-nums text-[#c9cfd8]">{{ fmt(text.board.seconds, { count: SEGMENTS[index].target }) }}</span>
        </li>
      </ol>
    </div>
  </section>

  <div
    data-testid="sticky-depart"
    :hidden="!stickyVisible"
    class="fixed inset-x-0 bottom-0 z-30 flex gap-2 bg-card/95 px-3 pb-3.5 pt-2.5 shadow-[0_-6px_18px_rgb(16_19_26/0.12)] lg:hidden"
  >
    <button type="button" class="press min-h-13 flex-1 cursor-pointer rounded-2xl bg-express px-2 text-lg font-extrabold text-white shadow-[0_4px_0_var(--express-deep)]" @click="start">
      {{ text.board.depart }}
    </button>
  </div>
</template>
