<script setup lang="ts">
import { chip, cornerButton, gradeLabel, pill } from "~/games/precise-stop/labels";
import { u, useGame } from "~/games/precise-stop/shared";
import { STATIONS_PER_RUN } from "@/lib/games/precise-stop/config";
import { comboMultiplier } from "@/lib/games/precise-stop/scoring";
import { stationName } from "@/lib/games/precise-stop/stations";
import { fmt } from "@/lib/i18n/format";

/** 場景上方的站別、連擊、天氣標籤 */
defineEmits<{ pause: [] }>();
const game = useGame();
const text = computed(() => game.value.text);
// 只取這裡用到的值：行駛中每一格都會換 snapshot，但這些值很少變
const stop = computed(() => game.value.snapshot.value.stop);
const index = computed(() => game.value.snapshot.value.index);
const phase = computed(() => game.value.snapshot.value.phase);
const zoomed = computed(() => game.value.snapshot.value.zoomed);
const name = computed(() => stationName(stop.value.station, game.value.locale).name);
// 判定後顯示這一站套用的倍率；行駛中顯示「這一站停準的話」會拿到的倍率
const multiplier = computed(() => {
  const snapshot = game.value.snapshot.value;
  const last = snapshot.results.at(-1);
  return snapshot.phase === "judged" && last ? last.multiplier : comboMultiplier(snapshot.streak + 1);
});
</script>

<template>
  <div class="absolute flex items-start justify-between" :style="{ left: u(14), right: u(14), top: u(12), gap: u(8) }">
    <div class="flex min-w-0 flex-col items-start" :style="{ gap: u(6) }">
      <div class="flex flex-wrap" :style="{ gap: u(6) }">
        <span :style="pill('#1d3a8f')" data-testid="station-pill">
          {{ fmt(text.hud.station, { n: index + 1, total: STATIONS_PER_RUN }) }} · {{ name }}
        </span>
        <span v-if="multiplier > 1" :style="pill('#ffc83d', '#14171f')" data-testid="combo-pill">
          {{ fmt(text.hud.combo, { value: multiplier.toFixed(1) }) }}
        </span>
      </div>
      <div class="flex flex-wrap" :style="{ gap: u(6) }">
        <span v-if="zoomed && phase === 'running'" :style="{ ...chip, background: '#14171f', color: '#ffc83d' }">
          {{ text.hud.zoomTag }}
        </span>
        <template v-else>
          <span :style="chip">{{ stop.rain ? text.weather.rain : text.weather.clear }}</span>
          <span :style="chip">{{ gradeLabel(stop, text) }}</span>
        </template>
      </div>
    </div>
    <div class="flex shrink-0" :style="{ gap: u(6) }">
      <!-- 站點介紹和結算有自己的聲音鈕（蓋在場景上面），這裡只在行駛與判定時出現 -->
      <SoundButtons v-if="phase === 'running' || phase === 'judged'" :text="text" />
      <button
        v-if="phase === 'running'"
        type="button"
        data-no-brake
        :aria-label="text.stage.pause"
        class="flex shrink-0 cursor-pointer items-center justify-center text-white"
        :style="cornerButton"
        @click="$emit('pause')"
      >
        <Icon name="pause" :size="22" />
      </button>
    </div>
  </div>
</template>
