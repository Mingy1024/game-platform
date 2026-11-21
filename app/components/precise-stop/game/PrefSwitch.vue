<script setup lang="ts">
import { u } from "~/games/precise-stop/shared";
import type { Pref } from "@/lib/sound-pref";

/**
 * 暫停選單裡的開關，和右上的聲音鈕同步（R6、R14）。
 * pref 存的是「關掉」，開關顯示的是「開著」。
 */
const { pref, icons } = defineProps<{ pref: Pref; testId: string; icons: ["volume" | "music", "volumeOff" | "musicOff"] }>();
const off = usePref(pref);
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="!off"
    :data-testid="testId"
    class="flex cursor-pointer items-center justify-between bg-sign-tint text-sign"
    :style="{ minHeight: u(48), borderRadius: u(14), padding: `0 ${u(14)}`, fontSize: u(16), fontWeight: 800 }"
    @click="pref.write(!off)"
  >
    <span class="flex items-center" :style="{ gap: u(8) }">
      <Icon :name="off ? icons[1] : icons[0]" :size="20" />
      <slot />
    </span>
    <span
      aria-hidden="true"
      class="relative block shrink-0 rounded-full transition-colors"
      :style="{ width: u(46), height: u(26), background: off ? '#aab3c5' : '#1f9a66' }"
    >
      <span class="absolute rounded-full bg-white transition-[left]" :style="{ top: u(3), left: off ? u(3) : u(23), width: u(20), height: u(20) }" />
    </span>
  </button>
</template>
