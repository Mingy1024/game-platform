<script setup lang="ts">
import { shortGrade, textUnits } from "~/games/precise-stop/labels";
import type { GameText } from "~/games/precise-stop/shared";
import type { Route } from "@/lib/games/precise-stop/route";

/** 路線條的橫排版本（RouteStrip.vue） */
const { route, names, current, detailed } = defineProps<{
  route: Route;
  names: string[];
  current: number;
  detailed: boolean;
  text: GameText;
}>();

// 手機一欄約 62 px，放得下 4 個 14 px 的漢字；更長就上下交錯
const stagger = computed(() => !detailed && Math.max(...names.map(textUnits)) > 4.2);
const dot = computed(() => (detailed ? 22 : 18));
const label = 20;
const lineTop = computed(() => `${(stagger.value ? label : 0) + dot.value / 2 - 2}px`);

function nameClass(index: number) {
  const size = detailed ? "text-[15px]" : "text-sm";
  if (!stagger.value) return `font-extrabold ${size} max-w-full truncate`;
  // 交錯時站名可以超出自己這一欄，最多用到兩欄寬；頭尾兩站往內對齊，不要超出路線條
  const align =
    index === 0 ? "left-0 text-left" : index === route.stops.length - 1 ? "right-0 text-right" : "left-1/2 -translate-x-1/2";
  return `font-extrabold ${size} absolute w-[200%] truncate leading-5 ${align}`;
}
</script>

<template>
  <ol class="relative grid grid-cols-5" data-testid="route-strip">
    <span aria-hidden="true" class="absolute h-1 rounded-full bg-[#3a4f8f]" :style="{ left: '10%', right: '10%', top: lineTop }" />
    <span
      v-if="current > 0"
      aria-hidden="true"
      class="absolute h-1 rounded-full bg-edge"
      :style="{ left: '10%', width: `${Math.min(current, route.stops.length - 1) * 20}%`, top: lineTop }"
    />
    <li
      v-for="(stop, index) in route.stops"
      :key="stop.station"
      :aria-current="index === current ? 'step' : undefined"
      class="relative flex min-w-0 flex-col items-center gap-0.5 px-0.5 text-center"
      :style="stagger ? { paddingTop: `${label}px`, paddingBottom: `${label}px` } : undefined"
    >
      <RouteDot :done="current >= 0 && index < current" :active="index === current" :size="dot" />
      <span
        :class="nameClass(index)"
        :style="{ color: index === current ? '#ffc83d' : '#fff', ...(stagger ? (index % 2 ? { top: 0 } : { bottom: 0 }) : {}) }"
      >
        {{ names[index] }}
      </span>
      <template v-if="detailed">
        <span class="flex items-center gap-1 text-xs text-[#c9cfd8]">
          <WeatherIcon :rain="stop.rain" />
          <span class="sr-only">{{ stop.rain ? text.weather.rain : text.weather.clear }}・</span>
          {{ shortGrade(stop, text) }}
        </span>
        <span class="text-xs tabular-nums text-[#aab3c5]">{{ stop.speedKmh }} km/h</span>
      </template>
    </li>
  </ol>
</template>
