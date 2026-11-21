<script setup lang="ts">
import type { GameText } from "~/games/precise-stop/shared";

/** 右上的聲音鈕組：音樂、音效各一顆 */
defineProps<{ text: GameText }>();
</script>

<template>
  <MusicButton :text="text" />
  <MuteButton :text="text" />
</template>
