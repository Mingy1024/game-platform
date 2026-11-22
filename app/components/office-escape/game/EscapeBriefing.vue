<script setup lang="ts">
import { u, useGame } from "~/games/office-escape/shared";
import { SEGMENTS, SEGMENT_COUNT } from "@/lib/games/office-escape/config";
import { clockText } from "@/lib/games/office-escape/scoring";
import { fmt } from "@/lib/i18n/format";

/** 段落介紹：這一段的名稱、目標時間與要注意的東西（A1） */
defineEmits<{ depart: [] }>();
const game = useGame();
const text = computed(() => game.value.text);
const s = computed(() => game.value.snapshot.value);
const segment = computed(() => text.value.segments[s.value.segment]);
const target = computed(() => SEGMENTS[s.value.segment].target);
const button = useTemplateRef<HTMLButtonElement>("button");
onMounted(() => button.value?.focus({ preventScroll: true }));
</script>

<template>
  <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-end" data-no-brake data-testid="briefing" :style="{ padding: `${u(20)} ${u(24)} ${u(28)}`, gap: u(14) }">
    <div class="absolute inset-0" style="background: linear-gradient(rgba(10,12,18,0.1), rgba(10,12,18,0.55))" />
    <div
      class="pointer-events-auto relative w-full text-center text-ink"
      :style="{ background: '#ffffff', borderRadius: u(22), padding: u(6), boxShadow: `0 ${u(6)} 0 rgba(0,0,0,0.22)` }"
    >
      <div :style="{ border: `${u(2)} solid #1c1712`, borderRadius: u(17), padding: `${u(14)} ${u(16)}` }">
        <p :style="{ fontSize: u(14), fontWeight: 700, color: '#5a4f45' }">{{ fmt(text.hud.segment, { n: s.segment + 1, total: SEGMENT_COUNT }) }}</p>
        <h2 :style="{ fontSize: u(32), fontWeight: 900, lineHeight: 1.15, color: '#a8380a' }" data-testid="briefing-name">{{ segment.name }}</h2>
        <p :style="{ fontSize: u(16), marginTop: u(4) }">{{ segment.hint }}</p>
        <p class="tabular-nums" :style="{ fontSize: u(15), fontWeight: 700, marginTop: u(8), color: '#5a4f45' }">
          {{ fmt(text.briefing.target, { seconds: target }) }}{{ "\u3000" }}{{ fmt(text.briefing.clock, { time: clockText(s.tick) }) }}
        </p>
        <p :style="{ fontSize: u(13), color: '#5a4f45' }">{{ text.briefing.call }}</p>
      </div>
    </div>
    <button
      ref="button"
      type="button"
      data-testid="depart-button"
      class="pointer-events-auto relative flex w-full cursor-pointer items-center justify-center font-black text-white"
      :style="{ minHeight: u(60), borderRadius: u(18), background: '#e8762d', boxShadow: `0 ${u(5)} 0 #a8380a`, fontSize: u(24) }"
      @click="$emit('depart')"
    >
      {{ text.briefing.depart }}
    </button>
    <p class="relative hidden md:block" :style="{ fontSize: u(13), color: '#e3e7ec' }">{{ text.briefing.departHint }}</p>
  </div>
</template>
