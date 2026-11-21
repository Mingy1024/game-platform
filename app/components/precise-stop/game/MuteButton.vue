<script setup lang="ts">
import { cornerButton } from "~/games/precise-stop/labels";
import type { GameText } from "~/games/precise-stop/shared";
import { mutedPref, setMuted } from "@/lib/sound-pref";

/** 音效鈕：喇叭圖示，只開關音效（R6），狀態全站共用 */
defineProps<{ text: GameText }>();
const muted = usePref(mutedPref);
</script>

<template>
  <button
    type="button"
    data-no-brake
    data-testid="mute-button"
    :aria-label="muted ? text.stage.unmute : text.stage.mute"
    :aria-pressed="muted"
    class="flex shrink-0 cursor-pointer items-center justify-center text-white"
    :style="cornerButton"
    @click="setMuted(!muted)"
  >
    <Icon :name="muted ? 'volumeOff' : 'volume'" :size="22" />
  </button>
</template>
