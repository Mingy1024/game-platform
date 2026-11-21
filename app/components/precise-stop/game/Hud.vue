<script setup lang="ts">
import { u, useGame } from "~/games/precise-stop/shared";
import { fmt, formatDecimal } from "@/lib/i18n/format";

/** 行駛中的儀表：進度、速度、距離、煞車力、時間、煞車鈕。每一格畫面都會更新。 */
const game = useGame();
const text = computed(() => game.value.text);
const view = computed(() => {
  const { snapshot, locale } = game.value;
  const { train, stop, braking, zoomed, speedKmh } = snapshot.value;
  return {
    progress: Math.min(1, Math.max(0, 1 - train.distance / stop.startDistance)),
    speed: Math.round(speedKmh),
    distance:
      (train.distance < 0 ? "+" : "") +
      (zoomed && train.distance < 5 && train.distance > -5
        ? formatDecimal(Math.abs(train.distance), locale, 2)
        : formatDecimal(Math.abs(train.distance), locale, 1)),
    percent: Math.round(train.brake * 100),
    late: train.elapsed > stop.targetTime,
    elapsed: fmt(text.value.hud.elapsed, {
      elapsed: formatDecimal(train.elapsed, locale),
      target: formatDecimal(stop.targetTime, locale),
    }),
    braking,
    zoomed,
  };
});
const label = { fontSize: u(13), fontWeight: 700, color: "#aab3c5" };
const big = { fontSize: u(34), fontWeight: 900, lineHeight: 1.1 };
</script>

<template>
  <div
    class="absolute inset-x-0 bottom-0 flex flex-col"
    :style="{ top: `${(340 / 560) * 100}%`, padding: `${u(14)} ${u(18)} ${u(16)}`, gap: u(10) }"
  >
    <div
      role="progressbar"
      :aria-label="text.hud.progress"
      :aria-valuemin="0"
      :aria-valuemax="100"
      :aria-valuenow="Math.round(view.progress * 100)"
      class="relative"
      :style="{ height: u(10), borderRadius: u(5), background: '#2a3040' }"
    >
      <div class="absolute inset-y-0 left-0" :style="{ width: `${view.progress * 100}%`, borderRadius: u(5), background: '#6b7a99' }" />
      <div
        class="absolute"
        :style="{
          left: `${view.progress * 100}%`,
          top: u(-4),
          width: u(18),
          height: u(18),
          marginLeft: u(-9),
          borderRadius: u(6),
          background: '#cc4409',
          border: `${u(2)} solid #fff`,
        }"
      />
      <div class="absolute right-0" :style="{ top: u(-6), width: u(6), height: u(22), borderRadius: u(2), background: '#ffc83d' }" />
    </div>
    <div class="flex items-end justify-between">
      <div class="flex flex-col">
        <span :style="label">{{ text.hud.speed }}</span>
        <span class="tabular-nums" :style="big" data-testid="hud-speed">{{ view.speed }}<span :style="{ fontSize: u(16), marginLeft: u(4) }">km/h</span></span>
      </div>
      <div class="flex flex-col items-end">
        <span :style="label">{{ view.zoomed ? text.hud.toMarkPrecise : text.hud.toMark }}</span>
        <span class="tabular-nums" :style="{ ...big, color: '#ffc83d' }" data-testid="hud-distance">{{ view.distance }}<span :style="{ fontSize: u(16), marginLeft: u(4) }">m</span></span>
      </div>
    </div>
    <div class="flex justify-between" :style="{ ...label, gap: u(8) }">
      <span :style="{ color: view.braking ? '#fff' : undefined }" data-testid="hud-brake">
        {{ fmt(text.hud.brake, { percent: view.percent }) }}{{ "\u3000" }}{{ view.braking ? text.hud.braking : text.hud.coasting }}
      </span>
      <span class="tabular-nums text-right" :style="{ color: view.late ? '#ff8a57' : undefined }">{{ view.elapsed }}</span>
    </div>
    <div :style="{ height: u(8), borderRadius: u(4), background: '#2a3040', overflow: 'hidden' }">
      <div :style="{ width: `${view.percent}%`, height: '100%', background: '#ffc83d' }" />
    </div>
    <!-- 整個遊戲框都能按住煞車；這顆按鈕讓操作一目了然，也給鍵盤和輔助工具使用 -->
    <div
      aria-hidden="true"
      class="flex items-center justify-center font-black text-white"
      :style="{
        marginTop: u(2),
        minHeight: u(60),
        borderRadius: u(18),
        fontSize: u(22),
        background: view.braking ? '#a83606' : '#cc4409',
        boxShadow: view.braking ? `inset 0 ${u(4)} 0 #7d2804` : `0 ${u(5)} 0 #a83606`,
        transform: view.braking ? `translateY(${u(3)})` : undefined,
      }"
    >
      {{ view.braking ? text.hud.brakingButton : text.hud.holdBrake }}
    </div>
  </div>
</template>
