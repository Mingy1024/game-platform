<script setup lang="ts">
import { u, useGame } from "~/games/office-escape/shared";
import { SEGMENT_COUNT } from "@/lib/games/office-escape/config";
import { LAYOUT } from "@/lib/games/office-escape/route";
import { clockText, secondsToCall } from "@/lib/games/office-escape/scoring";
import { fmt, formatNumber } from "@/lib/i18n/format";

export type Popup = { id: number; text: string; tone: "good" | "bad" | "info" };

/** 奔跑中的儀表：段落、分數、時鐘與點名倒數、道具、連段、提示。每一格畫面都會更新。 */
const props = defineProps<{ popups: Popup[]; labels: { pause: string; mute: string; unmute: string; muteMusic: string; unmuteMusic: string } }>();
defineEmits<{ pause: [] }>();
const game = useGame();
const text = computed(() => game.value.text);
const view = computed(() => {
  const { snapshot, locale } = game.value;
  const s = snapshot.value;
  const left = secondsToCall(s.tick);
  const m = Math.floor(left / 60);
  const sec = Math.floor(left % 60);
  return {
    segment: s.segment,
    clock: clockText(s.tick),
    ratio: Math.max(0, Math.min(1, left / 90)),
    left: `${m}:${String(sec).padStart(2, "0")}`,
    urgent: left <= 10,
    score: formatNumber(s.score, locale),
    streak: s.streak > 1 ? 1 + Math.min(0.5, (s.streak - 1) * 0.1) : 0,
    coffee: s.coffee,
    headphones: s.headphones,
    dnd: s.dnd,
    stun: s.stun,
    // 前方 2 秒內有障礙的線：在畫面上緣先提示（F2）
    warnings: [...new Set(LAYOUT.obstacles.filter((o) => o.segment === s.segment && o.z > s.z && o.z <= s.z + s.speed * 2).map((o) => o.lane))],
  };
});
const chip = {
  display: "inline-flex",
  alignItems: "center",
  gap: u(6),
  height: u(30),
  padding: `0 ${u(12)}`,
  borderRadius: u(15),
  background: "rgba(20,24,32,0.78)",
  color: "#ffffff",
  fontSize: u(14),
  fontWeight: 700,
  whiteSpace: "nowrap" as const,
};
const iconButton = {
  width: u(44),
  height: u(44),
  minWidth: "44px",
  minHeight: "44px",
  borderRadius: u(14),
  border: `${u(2)} solid #ffffff`,
  background: "rgba(20,24,32,0.72)",
};
const tone = { good: "#4fd69c", bad: "#ff8a57", info: "#ffffff" } as const;
</script>

<template>
  <div class="pointer-events-none absolute inset-0" data-testid="hud">
    <div class="absolute inset-x-0 top-0" :style="{ height: u(150), background: 'linear-gradient(rgba(10,12,18,0.55), rgba(10,12,18,0))' }" />
    <div class="absolute flex flex-col items-start" :style="{ left: u(12), top: u(14), gap: u(6) }">
      <span
        role="img"
        :style="{ ...chip, padding: `0 ${u(10)}` }"
        :aria-label="fmt(text.hud.segment, { n: view.segment + 1, total: SEGMENT_COUNT })"
        data-testid="hud-segment"
      >
        <span class="tabular-nums">{{ view.segment + 1 }}／{{ SEGMENT_COUNT }}</span>
        <span class="flex" :style="{ gap: u(3) }">
          <span
            v-for="n in SEGMENT_COUNT"
            :key="n"
            :style="{ width: u(6), height: u(6), borderRadius: u(3), background: n - 1 <= view.segment ? '#ffb020' : 'rgba(255,255,255,0.35)' }"
          />
        </span>
      </span>
      <span :style="{ ...chip, fontSize: u(18) }" class="tabular-nums" data-testid="hud-score">{{ view.score }}</span>
    </div>

    <div class="absolute flex flex-col items-stretch" :style="{ left: '50%', top: u(12), transform: 'translateX(-50%)', width: u(168), gap: u(6) }">
      <div :style="{ background: '#ffffff', borderRadius: u(16), padding: u(4), boxShadow: `0 ${u(4)} 0 rgba(0,0,0,0.25)` }">
        <div
          :style="{ border: `${u(2)} solid #1c1712`, borderRadius: u(12), padding: `${u(2)} ${u(6)} ${u(4)}`, textAlign: 'center' }"
          :class="view.stun && view.stun !== 'gaze' ? 'text-express' : 'text-ink'"
        >
          <div class="tabular-nums" :aria-label="text.hud.clock" :style="{ fontSize: u(28), fontWeight: 900, lineHeight: 1.1, whiteSpace: 'nowrap' }" data-testid="hud-clock">
            {{ view.clock }}
          </div>
        </div>
      </div>
      <div class="flex items-center text-white" :style="{ gap: u(6), fontSize: u(12), fontWeight: 700 }">
        <span class="whitespace-nowrap">{{ text.hud.call }}</span>
        <div :style="{ flex: 1, height: u(10), borderRadius: u(5), background: 'rgba(255,255,255,0.35)', overflow: 'hidden' }">
          <div :style="{ width: `${view.ratio * 100}%`, height: '100%', background: view.urgent ? '#ff5a3d' : '#ffb020' }" />
        </div>
        <span class="tabular-nums" data-testid="hud-call">{{ view.left }}</span>
      </div>
    </div>

    <div class="pointer-events-auto absolute flex flex-col" :style="{ right: u(12), top: u(14), gap: u(8) }">
      <button
        type="button"
        data-no-brake
        data-testid="pause-button"
        class="flex cursor-pointer items-center justify-center text-white"
        :style="iconButton"
        :aria-label="props.labels.pause"
        @click="$emit('pause')"
      >
        <Icon name="pause" :size="20" />
      </button>
      <EscapeSoundButtons :labels="props.labels" />
    </div>

    <div class="absolute flex flex-wrap items-end" :style="{ left: u(12), bottom: u(16), right: u(12), gap: u(6) }">
      <span v-if="view.streak" :style="{ ...chip, background: 'rgba(255,255,255,0.92)', color: '#1c1712' }" data-testid="hud-streak">
        {{ fmt(text.hud.streak, { value: view.streak.toFixed(1) }) }}
      </span>
      <span v-if="view.coffee" :style="chip" data-testid="hud-coffee">{{ text.hud.coffee }}</span>
      <span v-if="view.headphones" :style="chip" data-testid="hud-headphones">{{ text.hud.headphones }}</span>
      <span v-if="view.dnd" :style="chip" data-testid="hud-dnd">{{ text.hud.dnd }}</span>
    </div>

    <span
      v-for="lane in view.warnings"
      :key="lane"
      data-testid="hud-warning"
      aria-hidden="true"
      class="absolute flex items-center justify-center"
      :style="{ left: `calc(${50 + lane * 22}% - ${u(18)})`, top: u(168), width: u(36), height: u(36), borderRadius: u(10), background: '#ffb020', border: `${u(2)} solid #1c1712`, fontWeight: 900, fontSize: u(20), color: '#1c1712' }"
      >!</span
    >
    <div class="absolute inset-x-0 flex flex-col items-center" :style="{ top: u(190), gap: u(6) }" aria-live="polite">
      <span
        v-for="popup in props.popups"
        :key="popup.id"
        class="ps-float font-black"
        data-testid="hud-popup"
        :style="{
          fontSize: u(26),
          color: tone[popup.tone],
          WebkitTextStroke: `${u(5)} #1c1712`,
          paintOrder: 'stroke fill',
          whiteSpace: 'nowrap',
        }"
        >{{ popup.text }}</span
      >
    </div>
  </div>
</template>
