<script setup lang="ts">
import { u } from "~/games/mine-descent/shared";
import { mutedPref, setMuted } from "@/lib/sound-pref";

/** 右上的聲音鈕：喇叭開關音效（全站共用的設定）。這款遊戲沒有背景音樂，所以沒有音符鈕 */
const props = defineProps<{ labels: { mute: string; unmute: string } }>();
const muted = usePref(mutedPref);
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
