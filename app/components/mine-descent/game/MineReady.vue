<script setup lang="ts">
import { u, useGame } from "~/games/mine-descent/shared";

/** 準備畫面（F1）：標題、開始鈕。按下開始、Enter 或空白鍵才開始；前幾秒左右半邊的觸控提示在遊戲開始後顯示（HUD） */
defineEmits<{ depart: [] }>();
const game = useGame();
const text = computed(() => game.value.text);
const button = useTemplateRef<HTMLButtonElement>("button");
onMounted(() => button.value?.focus({ preventScroll: true }));
</script>

<template>
  <div class="absolute inset-0 flex flex-col items-center" data-no-brake data-testid="ready-panel" :style="{ background: 'rgba(26,18,12,0.38)', padding: `${u(70)} ${u(24)} ${u(40)}`, gap: u(14) }">
    <div :style="{ transform: 'rotate(-3deg)', background: '#b9803f', border: `${u(5)} solid #1a120c`, boxShadow: `${u(7)} ${u(7)} 0 #1a120c`, padding: `${u(8)} ${u(26)} ${u(4)}` }">
      <h2 :style="{ fontSize: u(54), fontWeight: 900, fontStyle: 'italic', lineHeight: 1.1, color: '#fff3d0', WebkitTextStroke: `${u(3)} #1a120c`, paintOrder: 'stroke fill' }">{{ text.title }}</h2>
    </div>
    <p class="text-center" :style="{ fontSize: u(20), fontWeight: 900, color: '#fff3d0', textShadow: `${u(2)} ${u(2)} 0 #1a120c` }">{{ text.ready.body }}</p>
    <div class="mt-auto flex flex-col items-center" :style="{ gap: u(10) }">
      <button
        ref="button"
        type="button"
        data-testid="depart-in-game"
        class="cursor-pointer font-black"
        :style="{ minWidth: u(230), minHeight: u(60), borderRadius: u(14), background: '#ffd23f', color: '#1a120c', border: `${u(4)} solid #1a120c`, boxShadow: `${u(5)} ${u(5)} 0 #1a120c`, fontSize: u(28) }"
        @click="$emit('depart')"
      >
        {{ text.ready.depart }}
      </button>
      <p class="hidden md:block" :style="{ fontSize: u(14), fontWeight: 700, color: '#fff3d0', textShadow: `${u(1.5)} ${u(1.5)} 0 #1a120c` }">{{ text.ready.hint }}</p>
    </div>
  </div>
</template>
