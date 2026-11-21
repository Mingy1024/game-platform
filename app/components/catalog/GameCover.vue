<script setup lang="ts">
import type { GameManifest } from "@/lib/catalog/schema";

/**
 * 遊戲封面，放在有版本的路徑下。圖片填滿外框（外框決定大小），
 * 標題一定會出現在旁邊，所以封面當作裝飾圖（alt 留空）。
 * 封面很小、通常就在第一屏，所以不延遲載入。圖片已經是壓縮過的 webp，不另外轉檔。
 */
defineProps<{ game: Pick<GameManifest, "cover"> }>();
</script>

<template>
  <div class="relative overflow-hidden">
    <img :src="game.cover" alt="" loading="eager" decoding="async" class="absolute inset-0 size-full object-cover" >
  </div>
</template>
