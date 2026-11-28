<script setup lang="ts">
import { u, useGame } from "~/games/monk-soup-tower/shared";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fmt, formatNumber } from "@/lib/i18n/format";
import { musicOffPref, mutedPref } from "@/lib/sound-pref";

/** 暫停選單（F10）：音樂、音效開關（和右上的鈕同步），「繼續」「從第一層重來」「回介紹頁」 */
defineProps<{ base: Dictionary["preciseStop"]["pause"] }>();
defineEmits<{ resume: []; restart: []; back: [] }>();
const game = useGame();
const text = computed(() => game.value.text);
const status = computed(() => {
  const s = game.value.snapshot.value;
  const locale = game.value.locale;
  return fmt(text.value.pause.status, { floor: s.floor, soup: formatNumber(Math.round(s.soup / 10), locale), temp: formatNumber(Math.floor(s.temp), locale) });
});
const resume = useTemplateRef<HTMLButtonElement>("resume");
onMounted(() => resume.value?.focus());
const key = { fontSize: u(13), fontWeight: 700, padding: `${u(2)} ${u(8)}`, borderRadius: u(6), background: "rgba(255,255,255,0.2)" };
</script>

<template>
  <div class="absolute inset-0" data-ui data-testid="pause-dialog">
    <div class="absolute inset-0" style="background: rgba(35, 48, 45, 0.55)" />
    <div
      role="dialog"
      aria-modal="true"
      :aria-label="base.title"
      class="absolute flex flex-col"
      :style="{ left: u(20), right: u(20), top: u(150), padding: `${u(24)} ${u(22)}`, borderRadius: u(24), gap: u(12), background: '#f4f7f5', color: '#23302d', boxShadow: '0 18px 50px rgba(0,0,0,.3)' }"
    >
      <h2 class="text-center" :style="{ fontSize: u(26), fontWeight: 900 }">{{ base.title }}</h2>
      <p class="text-center tabular-nums" :style="{ fontSize: u(15), fontWeight: 700, color: '#33413e' }" data-testid="pause-status">{{ status }}</p>
      <PrefSwitch :pref="musicOffPref" test-id="music-switch" :icons="['music', 'musicOff']">{{ base.music }}</PrefSwitch>
      <PrefSwitch :pref="mutedPref" test-id="sound-switch" :icons="['volume', 'volumeOff']">{{ base.sound }}</PrefSwitch>
      <button
        ref="resume"
        type="button"
        data-testid="resume-button"
        class="flex cursor-pointer items-center justify-center text-white"
        :style="{ minHeight: `max(44px, ${u(52)})`, borderRadius: u(16), background: '#a8372c', boxShadow: `0 ${u(4)} 0 #6f211a`, fontSize: u(18), fontWeight: 900, gap: u(10) }"
        @click="$emit('resume')"
      >
        {{ base.resume }}
        <span class="hidden md:inline" :style="key">Esc</span>
      </button>
      <button
        type="button"
        data-testid="restart-button"
        class="flex cursor-pointer items-center justify-center"
        :style="{ minHeight: `max(44px, ${u(52)})`, borderRadius: u(16), background: '#e4ece8', fontSize: u(17), fontWeight: 900 }"
        @click="$emit('restart')"
      >
        {{ text.pause.restart }}
      </button>
      <button type="button" data-testid="pause-back" class="cursor-pointer font-bold underline underline-offset-4" :style="{ minHeight: `max(44px, ${u(44)})`, fontSize: u(15) }" @click="$emit('back')">
        {{ text.final.back }}
      </button>
      <p data-testid="pause-note" class="text-center" :style="{ fontSize: u(13), lineHeight: 1.55, color: '#5b6b67' }">{{ text.pause.note }}</p>
    </div>

  </div>
</template>
