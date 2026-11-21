<script setup lang="ts">
import { gradeLabel, pill } from "~/games/precise-stop/labels";
import { u, useGame } from "~/games/precise-stop/shared";
import { STATIONS_PER_RUN } from "@/lib/games/precise-stop/config";
import { gradeKind } from "@/lib/games/precise-stop/route";
import { stationBackground, stationName } from "@/lib/games/precise-stop/stations";
import { fmt, formatDecimal, formatNumber } from "@/lib/i18n/format";

/** 站點介紹：站牌、這一站的天氣、坡度、進站速度和目標時間 */
defineEmits<{ depart: [] }>();
const game = useGame();
const text = computed(() => game.value.text);
const locale = computed(() => game.value.locale);
const stop = computed(() => game.value.snapshot.value.stop);
const index = computed(() => game.value.snapshot.value.index);
const name = computed(() => stationName(stop.value.station, locale.value));
const kind = computed(() => gradeKind(stop.value.grade));
const hanzi = computed(() => /^[㐀-鿿]+$/.test(name.value.name));
const neighbour = (offset: number, fallback: string) => {
  const other = game.value.route.stops[index.value + offset];
  return other ? stationName(other.station, locale.value).name : fallback;
};
</script>

<template>
  <div class="absolute inset-0 overflow-hidden" data-testid="briefing" data-no-brake>
    <!-- 遊戲內的背景圖，尺寸跟著遊戲框縮放 -->
    <img
      :src="`/games/precise-stop/0.1.0/${stationBackground(stop.station)}`"
      alt=""
      class="absolute inset-0 size-full object-cover"
      style="object-position: 40% 50%"
    >
    <div v-if="stop.rain" class="ps-rain absolute inset-0" />
    <div class="absolute inset-0" style="background: rgba(16, 19, 26, 0.3)" />
    <div class="absolute z-10 flex" :style="{ right: u(14), top: u(12), gap: u(6) }">
      <SoundButtons :text="text" />
    </div>

    <div class="absolute flex flex-col items-center" :style="{ left: u(24), right: u(24), top: u(24), gap: u(12) }">
      <span :style="{ ...pill('#1d3a8f'), fontSize: u(15) }">
        {{ fmt(text.hud.station, { n: index + 1, total: STATIONS_PER_RUN }) }}
      </span>
      <div
        class="flex max-w-full flex-col items-center bg-white text-sign"
        :style="{ border: `${u(4)} solid #1d3a8f`, borderRadius: u(14), padding: `${u(6)} ${u(32)} ${u(6)}` }"
      >
        <span
          class="whitespace-nowrap"
          :style="{
            fontSize: u(name.name.length > 6 ? 30 : 44),
            fontWeight: 900,
            lineHeight: 1.2,
            letterSpacing: hanzi ? u(10) : undefined,
            marginRight: hanzi ? u(-10) : undefined,
          }"
          data-testid="briefing-station"
        >
          {{ name.name }}
        </span>
        <span :style="{ fontSize: u(14), fontWeight: 700, letterSpacing: u(2), color: '#4a5263' }">{{ name.sub }}</span>
        <div class="w-full bg-sign" :style="{ height: u(6), borderRadius: u(3), marginTop: u(2) }" />
        <span class="whitespace-nowrap" :style="{ marginTop: u(4), fontSize: u(13), fontWeight: 700, color: '#4a5263' }">
          {{
            fmt(text.briefing.neighbours, {
              previous: neighbour(-1, text.briefing.origin),
              next: neighbour(1, text.briefing.terminal),
            })
          }}
        </span>
      </div>
    </div>

    <div
      class="absolute flex flex-col"
      :style="{
        left: u(24),
        right: u(24),
        top: u(214),
        padding: `${u(14)} ${u(18)}`,
        borderRadius: u(18),
        background: 'rgba(16,19,26,0.9)',
        gap: u(10),
      }"
    >
      <p :style="{ fontSize: u(16), fontWeight: 900, color: '#ffc83d' }">{{ text.briefing.heading }}</p>
      <BriefRow v-if="stop.rain" icon="rain" tint="#2a3a5c" color="#8fb0ff" :title="text.briefing.rainTitle" :body="text.briefing.rainBody" />
      <BriefRow v-else icon="sun" tint="#3a3420" color="#ffc83d" :title="text.briefing.clearTitle" :body="text.briefing.clearBody" />
      <BriefRow v-if="kind === 'flat'" icon="flat" tint="#26303f" color="#c9cfd8" :title="text.briefing.flatTitle" :body="text.briefing.flatBody" />
      <BriefRow
        v-else
        :icon="kind === 'down' ? 'slopeDown' : 'slopeUp'"
        tint="#4a2a1c"
        color="#ff9a6b"
        :title="gradeLabel(stop, text)"
        :body="kind === 'down' ? text.briefing.downBody : text.briefing.upBody"
      />
      <BriefRow
        icon="gauge"
        tint="#3a3420"
        color="#ffc83d"
        :title="fmt(text.briefing.speed, { speed: stop.speedKmh, time: formatDecimal(stop.targetTime, locale) })"
        :body="fmt(text.briefing.speedBody, { distance: formatNumber(stop.startDistance, locale) })"
      />
    </div>

    <div class="absolute flex flex-col" :style="{ left: u(24), right: u(24), bottom: u(16), gap: u(6) }">
      <button
        type="button"
        data-testid="depart-button"
        class="cursor-pointer font-black text-white"
        :style="{ minHeight: u(58), borderRadius: u(18), background: '#cc4409', boxShadow: `0 ${u(5)} 0 #a83606`, fontSize: u(22) }"
        @click="$emit('depart')"
      >
        {{ text.briefing.depart }}
      </button>
      <p class="hidden text-center md:block" :style="{ fontSize: u(13), color: '#e3e7ec' }">{{ text.briefing.departHint }}</p>
    </div>
  </div>
</template>
