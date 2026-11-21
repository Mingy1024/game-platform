<script setup lang="ts">
import { cornerButton } from "~/games/precise-stop/labels";
import type { GameText } from "~/games/precise-stop/shared";
import { musicOffPref, setMusicOff } from "@/lib/sound-pref";

/** 音樂鈕：音符圖示，只開關背景音樂（R14），狀態全站共用 */
defineProps<{ text: GameText }>();
const off = usePref(musicOffPref);
</script>

<template>
  <button
    type="button"
    data-no-brake
    data-testid="music-button"
    :aria-label="off ? text.stage.unmuteMusic : text.stage.muteMusic"
    :aria-pressed="off"
    class="flex shrink-0 cursor-pointer items-center justify-center text-white"
    :style="cornerButton"
    @click="setMusicOff(!off)"
  >
    <Icon :name="off ? 'musicOff' : 'music'" :size="22" />
  </button>
</template>
