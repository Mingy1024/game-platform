<script setup lang="ts">
import { u } from "~/games/monk-soup-tower/shared";
import { musicOffPref, mutedPref, setMusicOff, setMuted } from "@/lib/sound-pref";

/** 右上的聲音鈕組（M1）：音符只開關背景音樂、喇叭只開關音效，互不影響；狀態全站共用 */
const props = defineProps<{ labels: { mute: string; unmute: string; muteMusic: string; unmuteMusic: string }; light?: boolean }>();
const muted = usePref(mutedPref);
const musicOff = usePref(musicOffPref);
const style = computed(() => ({
  width: u(44),
  height: u(44),
  minWidth: "44px",
  minHeight: "44px",
  borderRadius: u(12),
  background: props.light ? "#e4ece8" : "rgba(35,48,45,0.72)",
  color: props.light ? "#23302d" : "#fff",
}));
</script>

<template>
  <button
    type="button"
    data-ui
    data-testid="music-button"
    :aria-label="musicOff ? props.labels.unmuteMusic : props.labels.muteMusic"
    :aria-pressed="!musicOff"
    class="flex shrink-0 cursor-pointer items-center justify-center"
    :style="style"
    @click="setMusicOff(!musicOff)"
  >
    <Icon :name="musicOff ? 'musicOff' : 'music'" :size="20" />
  </button>
  <button
    type="button"
    data-ui
    data-testid="mute-button"
    :aria-label="muted ? props.labels.unmute : props.labels.mute"
    :aria-pressed="!muted"
    class="flex shrink-0 cursor-pointer items-center justify-center"
    :style="style"
    @click="setMuted(!muted)"
  >
    <Icon :name="muted ? 'volumeOff' : 'volume'" :size="20" />
  </button>
</template>
