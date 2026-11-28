<script setup lang="ts">
import { u, useGame } from "~/games/monk-soup-tower/shared";
import { FLOORS } from "@/lib/games/monk-soup-tower/config";
import { fmt, formatNumber } from "@/lib/i18n/format";

/**
 * 遊戲畫面上的資訊（F2）：左上層數 n/5、右上音符／喇叭／暫停，第二排湯量（碗＋%，湯面跟著晃）與溫度（℃＋熱氣）。
 * 下方依階段顯示畫線提示、「重畫」「按住走」。不放碼錶、不預告哪裡會灑（F3）。
 */
defineProps<{
  labels: { pause: string; mute: string; unmute: string; muteMusic: string; unmuteMusic: string };
  spill: { id: number; amount: number } | null;
  drawing: boolean;
}>();
defineEmits<{ pause: []; redraw: [] }>();
const game = useGame();
const text = computed(() => game.value.text);
const locale = computed(() => game.value.locale);
const s = computed(() => game.value.snapshot.value);
const live = computed(() => (s.value.phase === "paused" ? s.value.resumePhase : s.value.phase));
const soup = computed(() => Math.round(s.value.soup / 10));
const temp = computed(() => Math.floor(s.value.temp));
/** HUD 碗裡的湯面傾斜（度）：跟著左右的 θ，最多 ±35° */
const surface = computed(() => Math.max(-35, Math.min(35, (s.value.lat * 180) / Math.PI)));
/** 前後的 θ（起步、煞停、階梯）讓湯面上下晃：最多 ±3（SVG 單位，Codex 審查第 3 輪） */
const bob = computed(() => Math.max(-3, Math.min(3, s.value.lon * 8)));
/** 湯面的高度：剩下的湯越少越低，再加上前後晃動 */
const level = computed(() => 12 + (1 - soup.value / 100) * 9 + bob.value);
const chip = {
  display: "flex",
  alignItems: "center",
  gap: u(6),
  padding: `${u(5)} ${u(12)} ${u(5)} ${u(7)}`,
  borderRadius: "999px",
  fontWeight: 900,
  fontSize: u(17),
};
const iconButton = { width: u(44), height: u(44), minWidth: "44px", minHeight: "44px", borderRadius: u(12), background: "rgba(35,48,45,0.72)", color: "#fff" };
</script>

<template>
  <div class="pointer-events-none absolute inset-0" data-testid="hud">
    <div class="absolute flex items-start justify-between" :style="{ top: u(14), left: u(14), right: u(14), gap: u(8) }">
      <div
        class="flex items-center"
        role="img"
        data-testid="hud-floor"
        :aria-label="fmt(text.hud.floorAria, { floor: s.floor })"
        :style="{ gap: u(10), padding: `${u(6)} ${u(12)} ${u(6)} ${u(8)}`, background: 'rgba(35,48,45,0.72)', borderRadius: u(14) }"
      >
        <span class="flex flex-col-reverse items-center" :style="{ gap: u(2) }" aria-hidden="true">
          <i
            v-for="n in FLOORS"
            :key="n"
            class="block"
            :style="{ width: u(10 + (FLOORS - n) * 2.5), height: u(4), borderRadius: u(2), background: n === s.floor ? '#e0a43a' : n < s.floor ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.28)' }"
          />
        </span>
        <span aria-hidden="true" class="tabular-nums" :style="{ fontSize: u(24), fontWeight: 900, lineHeight: 1 }">{{ fmt(text.hud.floor, { floor: s.floor }) }}</span>
      </div>
      <div class="pointer-events-auto flex" :style="{ gap: u(8) }">
        <MonkSoundButtons :labels="labels" />
        <button type="button" data-ui data-testid="pause-button" :aria-label="labels.pause" class="flex cursor-pointer items-center justify-center" :style="iconButton" @click="$emit('pause')">
          <Icon name="pause" :size="20" />
        </button>
      </div>
    </div>

    <div class="absolute flex" :style="{ top: u(72), left: u(14), gap: u(8) }">
      <div :key="spill?.id ?? 0" role="img" data-testid="hud-soup" :data-soup="soup" :aria-label="fmt(text.hud.soupAria, { soup })" :class="spill ? 'mst-flash relative' : 'relative'" :style="{ ...chip, background: 'rgba(35,48,45,0.72)' }">
        <svg viewBox="0 0 26 26" :style="{ width: u(26), height: u(26), overflow: 'visible' }" aria-hidden="true">
          <defs>
            <clipPath id="mst-bowl"><path d="M3 12h20a10 10 0 0 1-20 0z" /></clipPath>
          </defs>
          <path d="M3 12h20a10 10 0 0 1-20 0z" fill="#f4f2ea" />
          <g clip-path="url(#mst-bowl)">
            <rect x="-6" :y="level" width="38" height="20" fill="#e0a43a" :transform="`rotate(${surface} 13 ${level})`" data-testid="hud-surface" :data-angle="surface.toFixed(1)" :data-bob="bob.toFixed(2)" />
          </g>
          <path d="M3 12h20" stroke="#3d6fa8" stroke-width="2" stroke-linecap="round" />
          <rect x="9" y="22" width="8" height="2.5" rx="1" fill="#f4f2ea" />
        </svg>
        <span class="tabular-nums">{{ formatNumber(soup, locale) }}</span><span :style="{ fontSize: u(12), fontWeight: 700, opacity: 0.8 }">%</span>
        <span v-if="spill" :key="spill.id" class="mst-float absolute font-black text-[#ffb3a8]" :style="{ right: u(4), top: u(-20), fontSize: u(16) }" data-testid="spill-pop" aria-hidden="true">{{ fmt(text.hud.spill, { amount: spill.amount }) }}%</span>
      </div>
      <div role="img" data-testid="hud-temp" :data-cold="s.cold" :aria-label="fmt(text.hud.tempAria, { temp })" :style="{ ...chip, background: s.cold ? 'rgba(52,92,140,0.92)' : 'rgba(35,48,45,0.72)' }">
        <svg v-if="!s.cold" viewBox="0 0 26 26" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" :style="{ width: u(26), height: u(26) }" aria-hidden="true" data-testid="icon-steam">
          <path d="M8 21c-3-3 3-5 0-9s2-6 0-9" />
          <path d="M15 21c-3-3 3-5 0-9s2-6 0-9" opacity=".7" />
        </svg>
        <svg v-else viewBox="0 0 26 26" fill="none" stroke="#dbe9ff" stroke-width="2" stroke-linecap="round" :style="{ width: u(26), height: u(26) }" aria-hidden="true" data-testid="icon-cold">
          <path d="M13 3v20M4.3 8l17.4 10M4.3 18 21.7 8" />
          <path d="m10 5 3 2 3-2M10 21l3-2 3 2" />
        </svg>
        <span class="tabular-nums">{{ formatNumber(temp, locale) }}</span><span :style="{ fontSize: u(12), fontWeight: 700, opacity: 0.8 }">℃</span>
      </div>
    </div>

    <!-- 暫停時收起下方的提示與按鈕（暫停選單的說明文字才不會疊在上面） -->
    <div v-if="s.phase !== 'paused'" class="absolute inset-x-0 bottom-0 flex flex-col items-center" :style="{ padding: `${u(40)} ${u(16)} ${u(22)}`, gap: u(10), background: 'linear-gradient(to top, rgba(35,48,45,.45), rgba(35,48,45,0))' }">
      <p v-if="live === 'draw'" data-testid="draw-hint" class="text-center" :style="{ fontSize: u(16), fontWeight: 900, textShadow: '0 1px 4px rgba(0,0,0,.45)' }">
        {{ drawing ? text.draw.goal : text.draw.start }}
      </p>
      <div v-if="live === 'ready' || live === 'walk'" class="flex items-center justify-center" :style="{ gap: u(14) }">
        <button
          v-if="live === 'ready'"
          type="button"
          data-ui
          data-testid="redraw-button"
          class="pointer-events-auto flex cursor-pointer items-center justify-center"
          :style="{ minHeight: `max(44px, ${u(52)})`, padding: `${u(6)} ${u(16)}`, borderRadius: u(16), background: 'rgba(244,247,245,.92)', color: '#23302d', fontSize: u(16), fontWeight: 900, gap: u(6), lineHeight: 1.15 }"
          @click="$emit('redraw')"
        >
          <Icon name="restart" :size="18" />
          {{ text.draw.redraw }}
        </button>
        <span
          data-testid="hold-button"
          :data-down="s.holding"
          class="pointer-events-auto flex select-none items-center justify-center"
          :style="{
            // 長語言（葡文）會折成兩行：用最小高度讓按鈕跟著撐高，不固定高度（翻譯版面檢查）
            minHeight: `max(48px, ${u(64)})`,
            minWidth: u(170),
            maxWidth: u(220),
            padding: `${u(6)} ${u(22)}`,
            lineHeight: 1.15,
            textAlign: 'center',
            borderRadius: u(20),
            fontSize: u(21),
            fontWeight: 900,
            color: '#fff',
            background: '#a8372c',
            boxShadow: s.holding ? `0 ${u(1)} 0 #6f211a` : `0 ${u(5)} 0 #6f211a`,
            transform: s.holding ? `translateY(${u(4)})` : 'none',
            gap: u(6),
          }"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" :style="{ width: u(24), height: u(24) }" aria-hidden="true">
            <ellipse cx="8" cy="15" rx="3.2" ry="5" />
            <ellipse cx="16" cy="9" rx="3.2" ry="5" />
          </svg>
          {{ text.draw.hold }}
        </span>
      </div>
      <p v-if="live === 'ready'" class="text-center" :style="{ fontSize: u(13), fontWeight: 700, opacity: 0.9, textShadow: '0 1px 4px rgba(0,0,0,.45)' }">{{ text.draw.holdHint }}</p>
    </div>
  </div>
</template>
