<script setup lang="ts">
import { BOARD_ID, useExperience } from "~/games/precise-stop/shared";
import { bestOf } from "@/lib/games/precise-stop/records";
import { dailyRoute, taiwanDateKey, type Mode } from "@/lib/games/precise-stop/route";
import { fmt, formatFullDate, formatNumber, formatShortDate } from "@/lib/i18n/format";

/**
 * 出發看板：仿車站的發車看板。一列一個模式，附上「我的最佳」和出發鈕，
 * 下面預覽今日挑戰 5 站的天氣、坡度和進站速度。
 * 今日路線依台灣日期決定，所以在瀏覽器端計算（預先產生的頁面是共用的）。
 */
const { text, locale, start } = useExperience();
const records = useRecords();
const todayKey = useClientValue(taiwanDateKey);
const today = computed(() => (todayKey.value ? dailyRoute(todayKey.value) : null));
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

const dateKey = computed(() => today.value?.dateKey ?? null);
const best = (mode: Mode) => {
  const value = bestOf(records.value, mode, dateKey.value);
  return value === null ? "—" : formatNumber(value, locale);
};
const rows = computed(() => [
  {
    mode: "daily" as const,
    name: text.modes.daily,
    desc: fmt(text.modes.dailyDesc, { date: dateKey.value ? formatShortDate(dateKey.value, locale) : "…" }),
    primary: true,
  },
  { mode: "free" as const, name: text.modes.free, desc: text.modes.freeDesc, primary: false },
]);
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
      <span class="text-sm font-bold tabular-nums text-[#c9cfd8]">
        {{ dateKey ? formatFullDate(dateKey, locale) : "" }}
      </span>
    </div>

    <div
      aria-hidden="true"
      class="hidden grid-cols-[minmax(0,1fr)_4.5rem_5.5rem_7rem] gap-3 px-4 text-xs font-bold text-[#8fa0c8] lg:grid"
    >
      <span>{{ text.board.colMode }}</span>
      <span>{{ text.board.colStops }}</span>
      <span>{{ text.board.colBest }}</span>
      <span />
    </div>

    <div
      v-for="row in rows"
      :key="row.mode"
      :class="`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-3.5 py-3 lg:grid-cols-[minmax(0,1fr)_4.5rem_5.5rem_7rem] lg:px-4 ${
        row.primary ? 'bg-sign' : 'bg-white/[0.06]'
      }`"
    >
      <div class="min-w-0">
        <p class="text-xl font-extrabold">{{ row.name }}</p>
        <p class="text-sm text-[#c9cfd8]">
          {{ row.desc }}<span class="lg:hidden">{{ " · " }}{{ text.board.best }}{{ " " }}<strong class="tabular-nums text-edge">{{ best(row.mode) }}</strong></span>
        </p>
      </div>
      <span class="hidden text-sm font-bold text-[#c9cfd8] lg:block">{{ text.board.stops }}</span>
      <span class="hidden text-lg font-extrabold tabular-nums text-edge lg:block" :data-testid="`best-${row.mode}`">
        {{ best(row.mode) }}
      </span>
      <button
        type="button"
        :aria-label="fmt(text.board.departMode, { mode: row.name })"
        :data-testid="`depart-${row.mode}`"
        :class="`press flex min-h-13 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl px-4 text-lg font-extrabold ${
          row.primary
            ? 'bg-express text-white shadow-[0_4px_0_var(--express-deep)]'
            : 'bg-white text-sign shadow-[0_4px_0_#a3adbd]'
        }`"
        @click="start(row.mode)"
      >
        {{ text.board.depart }}
        <Icon name="play" :size="14" class="fill-current" />
      </button>
    </div>

    <div class="rounded-2xl bg-black/[0.22] px-2 pb-2.5 pt-3">
      <p class="mb-2 px-1.5 text-sm font-bold text-[#8fa0c8]">{{ text.board.routeTitle }}</p>
      <RouteStrip v-if="today" :route="today" detailed :text="text" :locale="locale" />
      <div v-else class="h-[84px]" aria-hidden="true" />
    </div>
  </section>

  <div
    data-testid="sticky-depart"
    :hidden="!stickyVisible"
    class="fixed inset-x-0 bottom-0 z-30 flex gap-2 bg-card/95 px-3 pb-3.5 pt-2.5 shadow-[0_-6px_18px_rgb(16_19_26/0.12)] lg:hidden"
  >
    <button
      type="button"
      class="press min-h-13 flex-[1.4] cursor-pointer rounded-2xl bg-express px-2 text-lg font-extrabold text-white shadow-[0_4px_0_var(--express-deep)]"
      @click="start('daily')"
    >
      {{ fmt(text.board.departMode, { mode: text.modes.daily }) }}
    </button>
    <button
      type="button"
      class="min-h-13 flex-1 cursor-pointer rounded-2xl px-2 font-extrabold text-sign ring-2 ring-inset ring-sign"
      @click="start('free')"
    >
      {{ text.modes.free }}
    </button>
  </div>
</template>
