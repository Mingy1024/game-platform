<script setup lang="ts">
import { u } from "~/games/mine-descent/shared";
import { musicOffPref, mutedPref, setMusicOff, setMuted } from "@/lib/sound-pref";

/** 右上的聲音鈕組：音符只開關背景音樂、喇叭只開關音效，互不影響；狀態全站共用 */
const props = defineProps<{ labels: { mute: string; unmute: string; muteMusic: string; unmuteMusic: string } }>();
const muted = usePref(mutedPref);
const musicOff = usePref(musicOffPref);
const style = {
  width: u(44),
  height: u(44),
  minWidth: "44px",
  minHeight: "44px",
  borderRadius: u(14),
  border: `${u(3)} solid #1a120c`,
  background: "#fff3d0",
  color: "#1a120c",
};
</script>

<template>
  <button
    type="button"
    data-no-brake
    data-testid="music-button"
    :aria-label="musicOff ? props.labels.unmuteMusic : props.labels.muteMusic"
    :aria-pressed="!musicOff"
    class="flex shrink-0 cursor-pointer items-center justify-center"
    :style="style"
    @click="setMusicOff(!musicOff)"
  >
    <Icon :name="musicOff ? 'musicOff' : 'music'" :size="22" />
  </button>
  <button
    type="button"
    data-no-brake
    data-testid="mute-button"
    :aria-label="muted ? props.labels.unmute : props.labels.mute"
    :aria-pressed="!muted"
    class="flex shrink-0 cursor-pointer items-center justify-center"
    :style="style"
    @click="setMuted(!muted)"
  >
    <Icon :name="muted ? 'volumeOff' : 'volume'" :size="22" />
  </button>
</template>
