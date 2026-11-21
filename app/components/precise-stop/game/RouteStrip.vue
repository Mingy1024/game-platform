<script setup lang="ts">
import { COMPACT_SCRIPT, shortGrade } from "~/games/precise-stop/labels";
import type { GameText } from "~/games/precise-stop/shared";
import type { Route } from "@/lib/games/precise-stop/route";
import { stationName } from "@/lib/games/precise-stop/stations";
import type { Locale } from "@/lib/i18n/locales";

/**
 * 路線條：5 站橫排，標出天氣、坡度、進站速度。
 * 介紹頁的看板用它預覽今日路線（detailed），遊戲中用它顯示目前進度。
 *
 * 音譯的站名（Sakurazaka、사쿠라자카）在手機上一欄放不下：
 * - 看板：這些語言在手機寬度改成一站一行的清單
 * - 遊戲中：站名上下交錯，每個站名可以用到兩欄的寬度
 */
const { route, current = -1, locale } = defineProps<{
  route: Route;
  current?: number;
  detailed: boolean;
  text: GameText;
  locale: Locale;
}>();
const names = computed(() => route.stops.map((stop) => stationName(stop.station, locale).name));
const status = (index: number) => ({ done: current >= 0 && index < current, active: index === current });
const compact = computed(() => COMPACT_SCRIPT.includes(locale));
</script>

<template>
  <template v-if="detailed && !compact">
    <div class="hidden sm:block">
      <RouteRow :route="route" :names="names" :current="current" detailed :text="text" />
    </div>
    <ol class="flex flex-col sm:hidden" data-testid="route-strip">
      <li
        v-for="(stop, index) in route.stops"
        :key="stop.station"
        :aria-current="status(index).active ? 'step' : undefined"
        class="relative flex min-h-8 items-center gap-2.5 px-1.5"
      >
        <span v-if="index > 0" aria-hidden="true" class="absolute left-[15px] top-0 h-1/2 w-1 -translate-x-1/2 bg-[#3a4f8f]" />
        <span
          v-if="index < route.stops.length - 1"
          aria-hidden="true"
          class="absolute bottom-0 left-[15px] h-1/2 w-1 -translate-x-1/2 bg-[#3a4f8f]"
        />
        <span class="relative"><RouteDot v-bind="status(index)" :size="18" /></span>
        <span class="min-w-0 flex-1 truncate font-extrabold">{{ names[index] }}</span>
        <span class="flex shrink-0 items-center gap-1 text-sm text-[#c9cfd8]">
          <WeatherIcon :rain="stop.rain" />
          <span class="sr-only">{{ stop.rain ? text.weather.rain : text.weather.clear }}・</span>
          {{ shortGrade(stop, text) }}
        </span>
        <span class="w-[4.5rem] shrink-0 text-right text-sm tabular-nums text-[#aab3c5]">{{ stop.speedKmh }} km/h</span>
      </li>
    </ol>
  </template>
  <RouteRow v-else :route="route" :names="names" :current="current" :detailed="detailed" :text="text" />
</template>
