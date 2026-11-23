<script setup lang="ts">
import { poseSvg, type Pose } from "~/games/mine-descent/art";

/** 地鼠的一個姿勢（結算、介紹頁用）。size 是 CSS 長度（高度），寬度依比例 */
const props = defineProps<{ pose: Pose; size: string }>();
const svg = computed(() => poseSvg(props.pose));
</script>

<template>
  <!-- 內容是 art.ts 自己產生的 SVG 字串，沒有任何使用者輸入 -->
  <!-- eslint-disable-next-line vue/no-v-html -->
  <span aria-hidden="true" class="block shrink-0 [&>svg]:size-full" :style="{ height: size, width: `calc(${size} * 136 / 180)` }" v-html="svg" />
</template>
