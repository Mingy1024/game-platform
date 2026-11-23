<script setup lang="ts">
import { u, useGame } from "~/games/mine-descent/shared";
import { HEALTH } from "@/lib/games/mine-descent/config";
import { fmt, formatNumber } from "@/lib/i18n/format";

export type Popup = { id: number; text: string; tone: "good" | "bad" | "info"; x: number; y: number };

/** 進行中的儀表：深度、體力（安全帽）、連段倍率、分數、提示字、前 3 秒的觸控提示。每一格畫面都會更新。 */
const props = defineProps<{ popups: Popup[]; hint: boolean; labels: { pause: string; mute: string; unmute: string; muteMusic: string; unmuteMusic: string } }>();
defineEmits<{ pause: [] }>();
const game = useGame();
const text = computed(() => game.value.text);
const view = computed(() => {
  const { snapshot, locale } = game.value;
  const s = snapshot.value;
  return {
    depth: formatNumber(s.depth, locale),
    score: formatNumber(s.score, locale),
    hp: s.hp,
    mult: s.mult > 1 ? s.mult.toFixed(1) : null,
    warning: s.phase === "playing" && s.headroom < 1.2,
  };
});
const tone = { good: "#ffd23f", bad: "#ff6b4a", info: "#fff3d0" } as const;
const iconButton = {
  width: u(44),
  height: u(44),
  minWidth: "44px",
  minHeight: "44px",
  borderRadius: u(14),
  border: `${u(3)} solid #1a120c`,
  background: "#fff3d0",
  color: "#1a120c",
};
const plank = {
  background: "#b9803f",
  border: `${u(4)} solid #1a120c`,
  boxShadow: `${u(5)} ${u(5)} 0 #1a120c`,
  color: "#1a120c",
};
void props;
</script>

<template>
  <div class="pointer-events-none absolute inset-0" data-testid="hud">
    <div class="absolute flex flex-col items-start" :style="{ left: u(10), top: u(64), gap: u(8) }">
      <div :style="{ ...plank, transform: 'rotate(-3deg)', padding: `${u(6)} ${u(12)} ${u(2)}` }" data-testid="hud-depth" :aria-label="fmt(text.hud.depthAria, { depth: view.depth })" role="img">
        <div :style="{ fontSize: u(12), fontWeight: 900 }">{{ text.hud.depth }}</div>
        <div :style="{ fontSize: u(38), fontWeight: 900, fontStyle: 'italic', lineHeight: 1, color: '#fff3d0', WebkitTextStroke: `${u(2)} #1a120c`, paintOrder: 'stroke fill' }" class="tabular-nums">
          {{ view.depth }}<span :style="{ fontSize: u(17) }"> {{ text.hud.unit }}</span>
        </div>
      </div>
    </div>
    <div class="pointer-events-auto absolute flex flex-col" :style="{ right: u(10), top: u(8), gap: u(8) }">
      <button type="button" data-no-brake data-testid="pause-button" class="flex cursor-pointer items-center justify-center" :style="iconButton" :aria-label="props.labels.pause" @click="$emit('pause')">
        <Icon name="pause" :size="20" />
      </button>
      <MineSoundButtons :labels="props.labels" />
    </div>
    <div v-if="view.mult" class="absolute" :style="{ right: u(10), top: u(122), transform: 'rotate(4deg)', ...plank, background: '#ffd23f', borderRadius: u(10), padding: `${u(3)} ${u(10)}`, fontSize: u(24), fontWeight: 900 }" data-testid="hud-combo">
      ×{{ view.mult }}
    </div>
    <div class="absolute inset-x-0 bottom-0 flex items-center justify-between" :style="{ height: u(52), background: '#1a120c', borderTop: `${u(3)} solid #b9803f`, padding: `0 ${u(12)}` }">
      <div class="flex" :style="{ gap: u(3) }" role="img" :aria-label="fmt(text.hud.hearts, { hp: view.hp, total: HEALTH.max })" data-testid="hud-hearts" :data-hp="view.hp">
        <svg v-for="n in HEALTH.max" :key="n" viewBox="0 0 30 24" :style="{ width: u(28), height: u(22) }" aria-hidden="true">
          <path d="M4 16 Q5 5 15 4 Q25 5 26 16Z" :fill="n <= view.hp ? '#ffd23f' : '#4a4040'" stroke="#fff3d0" stroke-width="2" stroke-linejoin="round" />
          <rect x="1.5" y="15" width="27" height="5" rx="2" :fill="n <= view.hp ? '#ffd23f' : '#4a4040'" stroke="#fff3d0" stroke-width="2" />
          <circle cx="15" cy="9" r="2.2" fill="#fff3d0" />
        </svg>
      </div>
      <p class="tabular-nums" :style="{ fontSize: u(20), fontWeight: 900, color: '#ffd23f' }" data-testid="hud-score">{{ fmt(text.hud.score, { score: view.score }) }}</p>
    </div>

    <div v-if="view.warning" class="absolute inset-x-0 flex justify-center" :style="{ top: u(150) }" data-testid="hud-warning">
      <span :style="{ ...plank, background: '#e8452c', color: '#fff3d0', transform: 'rotate(-2deg)', padding: `${u(3)} ${u(16)}`, fontSize: u(21), fontWeight: 900 }">{{ text.hud.warning }}</span>
    </div>

    <div v-if="hint" class="absolute inset-y-0 flex flex-col items-center justify-center text-center" :style="{ left: 0, width: '50%', top: u(110), bottom: u(60), background: 'rgba(255,243,208,0.1)', borderRight: `${u(3)} dashed rgba(255,243,208,0.55)`, gap: u(8), color: '#fff3d0', fontSize: u(17), fontWeight: 900, textShadow: `${u(2)} ${u(2)} 0 #1a120c` }" data-testid="hint-left">
      <svg viewBox="0 0 64 64" :style="{ width: u(56), height: u(56) }" aria-hidden="true"><polygon points="40,8 12,32 40,56 40,40 56,40 56,24 40,24" fill="#fff3d0" stroke="#1a120c" stroke-width="4" stroke-linejoin="round" /></svg>
      {{ text.ready.holdLeft }}
    </div>
    <div v-if="hint" class="absolute inset-y-0 flex flex-col items-center justify-center text-center" :style="{ right: 0, width: '50%', top: u(110), bottom: u(60), background: 'rgba(255,243,208,0.1)', gap: u(8), color: '#fff3d0', fontSize: u(17), fontWeight: 900, textShadow: `${u(2)} ${u(2)} 0 #1a120c` }" data-testid="hint-right">
      <svg viewBox="0 0 64 64" :style="{ width: u(56), height: u(56) }" aria-hidden="true"><polygon points="24,8 52,32 24,56 24,40 8,40 8,24 24,24" fill="#fff3d0" stroke="#1a120c" stroke-width="4" stroke-linejoin="round" /></svg>
      {{ text.ready.holdRight }}
    </div>

    <div v-for="popup in popups" :key="popup.id" class="absolute text-center" :style="{ left: `${popup.x}%`, top: `${popup.y}%`, transform: 'translate(-50%, -50%)', fontSize: u(26), fontWeight: 900, color: tone[popup.tone], WebkitTextStroke: `${u(1.5)} #1a120c`, paintOrder: 'stroke fill', whiteSpace: 'nowrap' }" data-testid="popup">
      {{ popup.text }}
    </div>
  </div>
</template>
