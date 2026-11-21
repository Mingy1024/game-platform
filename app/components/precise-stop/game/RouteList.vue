<script setup lang="ts">
import { shortGrade } from "~/games/precise-stop/labels";
import { judgementColor, useGame } from "~/games/precise-stop/shared";
import { stationName } from "@/lib/games/precise-stop/stations";
import { formatNumber } from "@/lib/i18n/format";

/** 電腦遊戲畫面左側的本局路線：各站狀態與得分 */
const game = useGame();
const text = computed(() => game.value.text);
const locale = computed(() => game.value.locale);
const results = computed(() => game.value.snapshot.value.results);
const index = computed(() => game.value.snapshot.value.index);
const phase = computed(() => game.value.snapshot.value.phase);
</script>

<template>
  <ol class="flex flex-col gap-1">
    <li
      v-for="(stop, i) in game.route.stops"
      :key="stop.station"
      :aria-current="i === index && phase !== 'final' ? 'step' : undefined"
      class="flex items-center gap-3 rounded-xl px-2.5 py-2"
      :style="i === index && phase !== 'final' ? { background: 'rgba(255,200,61,0.14)', boxShadow: 'inset 0 0 0 2px #ffc83d' } : undefined"
    >
      <span
        class="box-border size-[22px] shrink-0 rounded-full border-4"
        :style="{
          background: results[i] || (i === index && phase !== 'final') ? '#ffc83d' : 'transparent',
          borderColor: i === index && phase !== 'final' ? '#cc4409' : results[i] ? '#ffc83d' : '#4a5263',
        }"
      />
      <span class="min-w-0 flex-1">
        <span
          class="block truncate font-extrabold"
          :style="{ color: i === index && phase !== 'final' ? '#ffc83d' : results[i] ? '#fff' : '#aab3c5' }"
        >
          {{ stationName(stop.station, locale).name }}
        </span>
        <span class="flex items-center gap-1 text-xs text-[#aab3c5]">
          <WeatherIcon :rain="stop.rain" />
          {{ shortGrade(stop, text) }} · {{ stop.speedKmh }} km/h
        </span>
      </span>
      <span class="text-sm font-extrabold tabular-nums" :style="{ color: results[i] ? judgementColor[results[i].judgement].text : '#6b7386' }">
        {{
          results[i]
            ? formatNumber(results[i].score, locale)
            : i === index && phase !== "final" && phase === "running"
              ? text.stage.running
              : "—"
        }}
      </span>
    </li>
  </ol>
</template>
