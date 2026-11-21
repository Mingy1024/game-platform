<script setup lang="ts">
import { paths, type IconName } from "@/lib/icons";

/** 裝飾用線條圖示；需要語意時由外層按鈕或連結提供文字。 */
const { name, size = 20 } = defineProps<{ name: IconName; size?: number }>();
</script>

<template>
  <svg
    aria-hidden="true"
    focusable="false"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path :d="paths[name]" />
  </svg>
</template>
