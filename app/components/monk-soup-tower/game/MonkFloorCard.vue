<script setup lang="ts">
import { u, useGame } from "~/games/monk-soup-tower/shared";
import { fmt } from "@/lib/i18n/format";

/** 層數牌（G1）：朱紅木牌寫「第三層」（中文用國字，其他語言用阿拉伯數字，K7） */
const props = defineProps<{ floor: number; visible: boolean }>();
const game = useGame();
const name = computed(() => game.value.text.floorNames[props.floor - 1] ?? "");
</script>

<template>
  <div
    data-testid="floor-card"
    :data-floor="floor"
    aria-live="polite"
    class="pointer-events-none absolute text-center transition-opacity duration-300"
    :style="{
      left: '50%',
      top: u(250),
      transform: 'translateX(-50%)',
      maxWidth: u(340),
      padding: `${u(14)} ${u(30)} ${u(16)}`,
      borderRadius: u(14),
      background: '#7e2620',
      color: '#fbefc4',
      border: `${u(3)} solid #e0a43a`,
      boxShadow: '0 10px 30px rgba(0,0,0,.3)',
      opacity: visible ? 1 : 0,
    }"
  >
    <b class="block whitespace-nowrap" :style="{ fontSize: u(38), fontWeight: 900, letterSpacing: u(3), lineHeight: 1.15 }">{{ name }}</b>
    <small :style="{ fontSize: u(14), opacity: 0.9 }">{{ fmt(game.text.hud.floor, { floor }) }}</small>
  </div>
</template>
