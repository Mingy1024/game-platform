<script setup lang="ts">
import { u, useGame } from "~/games/office-escape/shared";
import type { LinePool } from "@/lib/games/office-escape/route";
import { fmt, formatDecimal } from "@/lib/i18n/format";

/** 突發事件：放慢到 20%，3 秒內三選一（A5）。選項的順序每局隨機，第 1／2／3 個也能用鍵盤 1／2／3 */
const emit = defineEmits<{ answer: [position: number] }>();
const game = useGame();
const text = computed(() => game.value.text);
const view = computed(() => {
  const s = game.value.snapshot.value;
  const event = s.event;
  if (!event) return null;
  const line = text.value.lines[event.pool as LinePool][event.line];
  return {
    pool: event.pool as LinePool,
    prompt: line[0],
    options: event.order.map((grade) => line[1 + grade]),
    left: s.eventLeft ?? 0,
  };
});
const keyStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: u(26),
  height: u(26),
  padding: `0 ${u(6)}`,
  borderRadius: u(7),
  background: "#1c1712",
  color: "#ffffff",
  fontSize: u(13),
  fontWeight: 700,
};
</script>

<template>
  <div v-if="view" class="absolute inset-0 flex flex-col justify-end" data-no-brake data-testid="event-dialog" :style="{ padding: `${u(18)} ${u(16)} ${u(24)}`, gap: u(10) }">
    <div class="absolute inset-0" style="background: rgba(10, 12, 18, 0.5)" />
    <div class="relative" :style="{ background: '#ffffff', borderRadius: u(20), padding: `${u(12)} ${u(16)}`, color: '#1c1712', boxShadow: `0 ${u(5)} 0 rgba(0,0,0,0.25)` }">
      <div class="flex items-center justify-between" :style="{ gap: u(8), fontSize: u(13), fontWeight: 700, color: '#a8380a' }">
        <span>{{ text.event.title }} · {{ text.event.from[view.pool] }}</span>
        <span class="tabular-nums" data-testid="event-timer">{{ fmt(text.event.timer, { seconds: formatDecimal(view.left, game.locale) }) }}</span>
      </div>
      <p :style="{ fontSize: u(22), fontWeight: 900, lineHeight: 1.3, marginTop: u(4) }" data-testid="event-prompt">{{ view.prompt }}</p>
      <div :style="{ height: u(6), borderRadius: u(3), background: '#ece5dc', marginTop: u(8), overflow: 'hidden' }">
        <div :style="{ width: `${(view.left / 3) * 100}%`, height: '100%', background: view.left < 1 ? '#ff5a3d' : '#e8762d' }" />
      </div>
    </div>
    <button
      v-for="(option, index) in view.options"
      :key="index"
      type="button"
      :data-testid="`event-option-${index}`"
      class="relative flex w-full cursor-pointer items-center text-left font-bold"
      :style="{
        gap: u(12),
        minHeight: u(56),
        padding: `${u(8)} ${u(14)}`,
        borderRadius: u(16),
        border: `${u(2)} solid #1c1712`,
        background: '#ffffff',
        color: '#1c1712',
        fontSize: u(17),
        lineHeight: 1.3,
      }"
      @click="emit('answer', index)"
    >
      <span :style="keyStyle">{{ index + 1 }}</span>
      <span class="min-w-0 flex-1">{{ option }}</span>
    </button>
  </div>
</template>
