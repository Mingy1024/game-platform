<script setup lang="ts">
import { u, useGame } from "~/games/mine-descent/shared";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fmt, formatNumber } from "@/lib/i18n/format";
import { mutedPref } from "@/lib/sound-pref";

/** 暫停選單：繼續、重新開始、回到介紹；「音效」開關和右上的鈕同步 */
defineProps<{ base: Dictionary["preciseStop"]["pause"] }>();
defineEmits<{ resume: []; restart: []; back: [] }>();
const game = useGame();
const text = computed(() => game.value.text);
const status = computed(() => {
  const s = game.value.snapshot.value;
  const locale = game.value.locale;
  return fmt(text.value.pause.status, { depth: formatNumber(s.depth, locale), score: formatNumber(s.score, locale) });
});
const key = { fontSize: u(13), fontWeight: 700, padding: `${u(2)} ${u(8)}`, borderRadius: u(6) };
const resume = useTemplateRef<HTMLButtonElement>("resume");
onMounted(() => resume.value?.focus());
</script>

<template>
  <div class="absolute inset-0" data-no-brake data-testid="pause-dialog">
    <div class="absolute inset-0" style="background: rgba(26, 18, 12, 0.78)" />
    <div
      role="dialog"
      aria-modal="true"
      :aria-label="base.title"
      class="absolute flex flex-col"
      :style="{ left: u(40), right: u(40), top: u(60), padding: `${u(18)} ${u(22)}`, borderRadius: u(18), gap: u(10), background: '#b9803f', border: `${u(4)} solid #1a120c`, boxShadow: `${u(6)} ${u(6)} 0 #1a120c`, color: '#1a120c' }"
    >
      <p class="text-center" :style="{ fontSize: u(30), fontWeight: 900, fontStyle: 'italic', color: '#fff3d0', WebkitTextStroke: `${u(2.5)} #1a120c`, paintOrder: 'stroke fill' }">{{ base.title }}</p>
      <p class="text-center" :style="{ fontSize: u(15), fontWeight: 700 }">{{ status }}</p>
      <PrefSwitch :pref="mutedPref" test-id="sound-switch" :icons="['volume', 'volumeOff']">{{ base.sound }}</PrefSwitch>
      <button
        ref="resume"
        type="button"
        data-testid="resume-button"
        class="flex cursor-pointer items-center justify-center font-black"
        :style="{ minHeight: u(56), borderRadius: u(14), background: '#ffd23f', border: `${u(4)} solid #1a120c`, boxShadow: `${u(4)} ${u(4)} 0 #1a120c`, fontSize: u(20), gap: u(10) }"
        @click="$emit('resume')"
      >
        {{ base.resume }}
        <span class="hidden md:inline" :style="{ ...key, background: 'rgba(26,18,12,0.15)' }">P／Esc</span>
      </button>
      <button
        type="button"
        class="flex cursor-pointer items-center justify-center font-black"
        :style="{ minHeight: u(52), borderRadius: u(14), background: '#fff3d0', border: `${u(4)} solid #1a120c`, boxShadow: `${u(4)} ${u(4)} 0 #1a120c`, fontSize: u(18), gap: u(10) }"
        @click="$emit('restart')"
      >
        {{ base.restart }}
        <span class="hidden md:inline" :style="{ ...key, background: 'rgba(26,18,12,0.12)' }">R</span>
      </button>
      <button type="button" class="cursor-pointer font-bold" :style="{ minHeight: u(48), fontSize: u(16), color: '#fff3d0' }" @click="$emit('back')">
        {{ base.back }}
      </button>
    </div>
    <p class="absolute text-center" :style="{ left: u(24), right: u(24), bottom: u(22), fontSize: u(14), color: '#fff3d0', lineHeight: 1.6 }">
      {{ text.pause.note }}
    </p>
  </div>
</template>
