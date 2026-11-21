<script setup lang="ts">
import { u, useGame } from "~/games/precise-stop/shared";
import { formatNumber } from "@/lib/i18n/format";

/** 標線還沒進畫面時，右側的距離提示 */
const game = useGame();
const distance = computed(() => formatNumber(game.value.snapshot.value.train.distance, game.value.locale));
</script>

<template>
  <div
    data-testid="target-hint"
    class="absolute flex items-center"
    :style="{ right: u(6), top: u(190), gap: u(4), filter: 'drop-shadow(0 4px 6px rgba(16,19,26,0.5))' }"
  >
    <div
      class="flex flex-col items-center"
      :style="{ padding: `${u(7)} ${u(14)}`, borderRadius: u(16), background: 'rgba(16,19,26,0.88)', border: `${u(2.5)} solid #ffc83d` }"
    >
      <span :style="{ fontSize: u(12), fontWeight: 900, color: '#ffc83d', whiteSpace: 'nowrap' }">{{ game.text.hud.target }}</span>
      <span class="tabular-nums" :style="{ fontSize: u(21), fontWeight: 900, lineHeight: 1.2 }">{{ distance }} m</span>
    </div>
    <svg aria-hidden="true" viewBox="0 0 16 24" :style="{ width: u(14), height: u(22) }">
      <path d="M2 2l12 10L2 22z" fill="#ffc83d" stroke="#14171f" stroke-width="2" stroke-linejoin="round" />
    </svg>
  </div>
</template>
