<script setup lang="ts">
import { pill } from "~/games/precise-stop/labels";
import { judgementColor, u, useGame } from "~/games/precise-stop/shared";
import type { SaveOutcome } from "@/lib/games/precise-stop/records";
import { stationName } from "@/lib/games/precise-stop/stations";
import { fmt, formatError, formatNumber } from "@/lib/i18n/format";

/** 五站結算 */
defineProps<{ outcome: SaveOutcome | null }>();
defineEmits<{ share: []; again: []; changeMode: [] }>();
const game = useGame();
const text = computed(() => game.value.text);
const locale = computed(() => game.value.locale);
const route = computed(() => game.value.route);
const results = computed(() => game.value.snapshot.value.results);
const total = computed(() => game.value.snapshot.value.total);
const modeName = computed(() => (route.value.mode === "daily" ? text.value.modes.daily : text.value.modes.free));
const lastStop = computed(() => route.value.stops.at(-1));
const cells = `${u(96)} minmax(0, auto) minmax(0, 1fr) auto`;

function recordText(outcome: SaveOutcome) {
  const t = text.value;
  if (!outcome.isNewRecord) {
    return fmt(t.final.best, { mode: modeName.value, score: formatNumber(outcome.previousBest ?? total.value, locale.value) });
  }
  return `${t.final.newRecord} ${
    outcome.previousBest === null
      ? fmt(t.final.firstRecord, { mode: modeName.value })
      : fmt(t.final.recordChange, {
          mode: modeName.value,
          from: formatNumber(outcome.previousBest, locale.value),
          to: formatNumber(total.value, locale.value),
        })
  }`;
}

const errorText = (error: number) =>
  `${Math.round(Math.abs(error) * 100) === 0 ? "" : error > 0 ? "+" : "−"}${formatError(error, locale.value)}`;

const button = (background: string, shadow: string) => ({
  minHeight: u(48),
  borderRadius: u(16),
  background,
  boxShadow: `0 ${u(4)} 0 ${shadow}`,
  fontSize: u(17),
});
</script>

<template>
  <div data-testid="final-panel" data-no-brake class="absolute inset-0 flex flex-col bg-canvas" :style="{ padding: `${u(16)} ${u(20)} ${u(16)}`, gap: u(10) }">
    <div class="flex items-center justify-between" :style="{ gap: u(8) }">
      <span :style="pill('#cc4409')">{{ modeName }}</span>
      <div class="flex min-w-0 items-center" :style="{ gap: u(10) }">
        <span v-if="lastStop" class="truncate" :style="{ fontSize: u(14), fontWeight: 700, color: '#aab3c5' }">
          {{ fmt(text.final.terminal, { name: stationName(lastStop.station, locale).name }) }}
        </span>
        <div class="flex shrink-0" :style="{ gap: u(6) }"><SoundButtons :text="text" /></div>
      </div>
    </div>
    <div class="flex flex-col items-center" :style="{ gap: u(2) }">
      <span :style="{ fontSize: u(15), fontWeight: 700, color: '#aab3c5' }">{{ text.final.total }}</span>
      <span class="tabular-nums" :style="{ fontSize: u(54), fontWeight: 900, lineHeight: 1.05 }" data-testid="final-total" :data-total="total">
        <CountUp :value="total" :locale="locale" />
      </span>
      <span
        v-if="outcome"
        data-testid="record-note"
        :data-new-record="outcome.isNewRecord"
        class="text-center"
        :style="{
          ...pill(outcome.isNewRecord ? '#ffc83d' : '#1b2030', outcome.isNewRecord ? '#14171f' : '#c9cfd8'),
          marginTop: u(4),
          whiteSpace: 'normal',
        }"
      >
        {{ recordText(outcome) }}
      </span>
    </div>
    <ol :aria-label="text.final.stationsLabel" class="flex flex-col" :style="{ borderRadius: u(16), background: '#1b2030', padding: `${u(4)} ${u(14)}` }">
      <li
        v-for="(result, index) in results"
        :key="route.stops[index]?.station"
        class="grid items-baseline tabular-nums"
        :style="{
          gridTemplateColumns: cells,
          gap: u(8),
          padding: `${u(5)} 0`,
          borderTop: index ? '1px solid #2a3040' : undefined,
          fontSize: u(14),
          fontWeight: 700,
        }"
      >
        <span class="truncate">{{ stationName(route.stops[index]!.station, locale).name }}</span>
        <span :style="{ color: judgementColor[result.judgement].text }">{{ text.judgement[result.judgement] }}</span>
        <span class="truncate" style="color: #c9cfd8"
          >{{ errorText(result.error) }}{{ result.multiplier > 1 ? ` · ×${result.multiplier.toFixed(1)}` : ""
          }}{{ result.penalty > 0 ? ` · −${result.penalty}` : "" }}</span
        >
        <span class="text-right">{{ formatNumber(result.score, locale) }}</span>
      </li>
    </ol>
    <p v-if="outcome && !outcome.saved" class="text-center" :style="{ fontSize: u(12), color: '#aab3c5', lineHeight: 1.4 }" data-testid="not-saved">
      {{ text.final.notSaved }}
    </p>
    <div class="mt-auto flex flex-col" :style="{ gap: u(9) }">
      <button
        type="button"
        data-testid="share-button"
        class="flex cursor-pointer items-center justify-center font-black text-ink"
        :style="{ minHeight: u(52), borderRadius: u(16), background: '#ffc83d', boxShadow: `0 ${u(4)} 0 #b8860b`, fontSize: u(19), gap: u(8) }"
        @click="$emit('share')"
      >
        <Icon name="share" :size="20" />
        {{ text.final.share }}
      </button>
      <div class="flex" :style="{ gap: u(10) }">
        <button type="button" data-testid="again-button" class="flex-1 cursor-pointer font-black text-white" :style="button('#cc4409', '#a83606')" @click="$emit('again')">
          {{ text.final.again }}
        </button>
        <button
          type="button"
          data-testid="change-mode-button"
          class="flex-1 cursor-pointer font-black text-white"
          :style="{ minHeight: u(48), borderRadius: u(16), border: `${u(2)} solid #c9cfd8`, fontSize: u(17) }"
          @click="$emit('changeMode')"
        >
          {{ text.final.changeMode }}
        </button>
      </div>
    </div>
  </div>
</template>
