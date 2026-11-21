<script setup lang="ts">
import { judgementColor, u, useGame } from "~/games/precise-stop/shared";
import { comboMultiplier } from "@/lib/games/precise-stop/scoring";
import { stationName } from "@/lib/games/precise-stop/stations";
import { fmt, formatDecimal, formatError, formatNumber } from "@/lib/i18n/format";

/** 判定結果：誤差、停車分、準點、連擊、本站得分 */
defineEmits<{ next: [] }>();
const game = useGame();
const text = computed(() => game.value.text);
const locale = computed(() => game.value.locale);
const row = { display: "flex", justifyContent: "space-between", gap: u(8) } as const;
const muted = { color: "#aab3c5" };

const view = computed(() => {
  const { snapshot, route } = game.value;
  const state = snapshot.value;
  const result = state.results.at(-1);
  if (!result) return null;
  const t = text.value;
  const stop = route.stops[state.index]!;
  const emergency = state.train.emergency;
  const title =
    result.judgement === "miss" ? (result.error > 0 ? t.judgement.overrun : t.judgement.short) : t.judgement[result.judgement];
  const exact = Math.round(Math.abs(result.error) * 100) === 0;
  const detail = emergency
    ? t.judged.emergency
    : exact
      ? t.judged.exact
      : fmt(result.error > 0 ? t.judged.after : t.judged.before, { value: formatError(result.error, locale.value) });
  const nextStop = route.stops[state.index + 1];
  const elapsed = formatDecimal(state.train.elapsed, locale.value);
  const target = formatDecimal(stop.targetTime, locale.value);
  return {
    result,
    color: judgementColor[result.judgement],
    title,
    detail: detail + (result.judgement === "miss" && !emergency ? `（${t.judged.missNote}）` : ""),
    timeLabel:
      result.overtime > 0
        ? fmt(t.judged.overtime, { seconds: formatDecimal(result.overtime, locale.value) })
        : fmt(t.judged.onTime, { elapsed, target }),
    combo:
      result.streak > 0
        ? `×${result.multiplier.toFixed(1)}${
            nextStop ? `\u3000${fmt(t.judged.comboNext, { value: comboMultiplier(result.streak + 1).toFixed(1) })}` : ""
          }`
        : state.streak > 0
          ? `×${comboMultiplier(state.streak).toFixed(1)} → ${t.judged.comboBroken}`
          : "×1.0",
    nextLabel: nextStop ? fmt(t.judged.nextStation, { name: stationName(nextStop.station, locale.value).name }) : t.judged.toResults,
  };
});
</script>

<template>
  <div
    v-if="view"
    data-testid="judged-panel"
    :data-judgement="view.result.judgement"
    data-no-brake
    class="absolute inset-x-0 bottom-0 flex flex-col"
    :style="{ top: `${(340 / 560) * 100}%`, padding: `${u(10)} ${u(18)} ${u(14)}`, gap: u(6) }"
  >
    <div class="flex items-center justify-between" :style="{ gap: u(10) }">
      <div class="flex min-w-0 flex-col">
        <span :style="{ fontSize: u(view.title.length > 8 ? 26 : 34), fontWeight: 900, lineHeight: 1.1, color: view.color.text }">
          {{ view.title }}
        </span>
        <span :style="{ fontSize: u(14), fontWeight: 700, color: '#e3e7ec', lineHeight: 1.35 }">{{ view.detail }}</span>
      </div>
      <div class="flex shrink-0 flex-col items-end">
        <span :style="{ fontSize: u(13), fontWeight: 700, ...muted }">{{ text.judged.stationScore }}</span>
        <span class="tabular-nums" :style="{ fontSize: u(34), fontWeight: 900, lineHeight: 1.1 }" data-testid="station-score">
          {{ formatNumber(view.result.score, locale) }}
        </span>
      </div>
    </div>
    <div
      class="flex flex-col tabular-nums"
      :style="{ borderRadius: u(14), background: '#1b2030', padding: `${u(5)} ${u(14)}`, gap: u(2), fontSize: u(14), fontWeight: 700, lineHeight: 1.35 }"
    >
      <div :style="row">
        <span :style="muted">{{ text.judged.stopScore }}</span>
        <span>{{ formatNumber(view.result.stopScore, locale) }}</span>
      </div>
      <div :style="row">
        <span :style="muted">{{ view.timeLabel }}</span>
        <span :style="{ color: view.result.penalty > 0 ? '#ff8a57' : undefined }">
          {{ view.result.penalty > 0 ? `−${formatNumber(view.result.penalty, locale)}` : "±0" }}
        </span>
      </div>
      <div :style="row">
        <span :style="muted">{{ text.judged.combo }}</span>
        <span>{{ view.combo }}</span>
      </div>
    </div>
    <button
      type="button"
      data-testid="next-button"
      class="mt-auto cursor-pointer font-black text-white"
      :style="{ minHeight: u(50), borderRadius: u(18), background: '#cc4409', boxShadow: `0 ${u(5)} 0 #a83606`, fontSize: u(20) }"
      @click="$emit('next')"
    >
      {{ view.nextLabel }}
    </button>
  </div>
</template>
