<script setup lang="ts">
import { BOARD_ID, seconds, useExperience } from "~/games/monk-soup-tower/shared";
import { MODES } from "@/lib/games/monk-soup-tower/tower";
import { fmt, formatNumber } from "@/lib/i18n/format";

/**
 * 出發區（I1、I3）：固定關卡、隨機模式各一顆出發鈕，旁邊是這個模式的我的最佳。
 * 只有這兩顆鈕能開始遊戲。手機往下捲、出發區離開畫面後，底部出現固定的出發列。
 */
const { text, locale, start } = useExperience();
const records = useMonkRecords();
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

const modes = computed(() =>
  MODES.map((mode) => {
    const best = records.value[mode];
    return {
      mode,
      name: text.modes[mode],
      note: mode === "fixed" ? text.modes.fixedNote : text.modes.randomNote,
      score: best ? formatNumber(best.score, locale) : "—",
      time: best ? fmt(text.board.bestTime, { time: seconds(best.timeMs, locale) }) : "",
    };
  }),
);
</script>

<template>
  <section :id="BOARD_ID" ref="board" aria-labelledby="board-title" data-testid="departure-board" class="flex flex-col gap-3 rounded-[20px] bg-[#23302d] p-3.5 text-white sm:p-[18px]">
    <h2 id="board-title" class="flex items-center gap-2 text-lg font-extrabold sm:text-xl">
      <span class="size-2.5 rounded-full bg-[#e0a43a] shadow-[0_0_8px_#e0a43a]" aria-hidden="true" />
      {{ text.board.title }}
    </h2>
    <p class="text-sm text-[#c9d6d1]">{{ text.board.subtitle }}</p>
    <ul class="flex flex-col gap-2.5">
      <li v-for="item in modes" :key="item.mode" class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-[#34463f] px-3.5 py-3" :data-testid="`mode-${item.mode}`">
        <div class="min-w-0">
          <p class="text-lg font-extrabold leading-snug">{{ item.name }}</p>
          <p class="text-sm text-[#c9d6d1]">{{ item.note }}</p>
          <p class="mt-1 text-sm font-bold text-[#fbefc4]">
            {{ text.board.bestScore }}
            <span class="text-xl font-black tabular-nums" :data-testid="`best-${item.mode}`">{{ item.score }}</span>
            <span v-if="item.time" class="ml-1 tabular-nums text-[#c9d6d1]">{{ item.time }}</span>
          </p>
        </div>
        <button
          type="button"
          :aria-label="fmt(text.board.departAria, { mode: item.name })"
          :data-testid="`depart-${item.mode}`"
          class="press flex min-h-13 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl bg-[#a8372c] px-5 text-lg font-extrabold text-white shadow-[0_4px_0_#6f211a]"
          @click="start(item.mode)"
        >
          {{ text.board.depart }}
          <Icon name="play" :size="14" class="fill-current" />
        </button>
      </li>
    </ul>
  </section>

  <div data-testid="sticky-depart" :hidden="!stickyVisible" class="fixed inset-x-0 bottom-0 z-30 flex gap-2 bg-card/95 px-3 pb-3.5 pt-2.5 shadow-[0_-6px_18px_rgb(16_19_26/0.12)] lg:hidden">
    <button
      v-for="item in modes"
      :key="item.mode"
      type="button"
      class="press min-h-13 flex-1 cursor-pointer rounded-2xl px-2 text-base font-extrabold leading-tight shadow-[0_4px_0_#6f211a]"
      :class="item.mode === 'fixed' ? 'bg-[#a8372c] text-white' : 'bg-[#fbefc4] text-[#23302d]'"
      @click="start(item.mode)"
    >
      {{ item.name }}
    </button>
  </div>
</template>
