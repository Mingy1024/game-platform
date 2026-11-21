<script setup lang="ts">
import { u, useGame } from "~/games/precise-stop/shared";
import { stationName } from "@/lib/games/precise-stop/stations";
import { fmt, formatDecimal } from "@/lib/i18n/format";
import { musicOffPref, mutedPref } from "@/lib/sound-pref";

defineEmits<{ resume: []; restart: []; back: [] }>();
const game = useGame();
const text = computed(() => game.value.text);
const status = computed(() => {
  const { snapshot, locale } = game.value;
  const state = snapshot.value;
  return fmt(text.value.pause.status, {
    n: state.index + 1,
    name: stationName(state.stop.station, locale).name,
    distance: formatDecimal(Math.max(0, state.train.distance), locale),
  });
});
const key = { fontSize: u(13), fontWeight: 700, padding: `${u(2)} ${u(8)}`, borderRadius: u(6) };
const resumeButton = useTemplateRef<HTMLButtonElement>("resume");
onMounted(() => resumeButton.value?.focus());
</script>

<template>
  <div class="absolute inset-0" data-no-brake data-testid="pause-dialog">
    <div class="absolute inset-0" style="background: rgba(16, 19, 26, 0.72)" />
    <div
      role="dialog"
      aria-modal="true"
      :aria-label="text.pause.title"
      class="absolute flex flex-col bg-white text-ink"
      :style="{ left: u(40), right: u(40), top: u(46), padding: `${u(18)} ${u(22)}`, borderRadius: u(22), gap: u(10) }"
    >
      <p class="text-center text-sign" :style="{ fontSize: u(28), fontWeight: 900 }">{{ text.pause.title }}</p>
      <p class="text-center text-muted" :style="{ fontSize: u(14) }">{{ status }}</p>
      <div class="flex flex-col" :style="{ gap: u(6) }">
        <PrefSwitch :pref="mutedPref" test-id="sound-switch" :icons="['volume', 'volumeOff']">{{ text.pause.sound }}</PrefSwitch>
        <PrefSwitch :pref="musicOffPref" test-id="music-switch" :icons="['music', 'musicOff']">{{ text.pause.music }}</PrefSwitch>
      </div>
      <button
        ref="resume"
        type="button"
        data-testid="resume-button"
        class="flex cursor-pointer items-center justify-center font-black text-white"
        :style="{ minHeight: u(56), borderRadius: u(16), background: '#cc4409', boxShadow: `0 ${u(4)} 0 #a83606`, fontSize: u(20), gap: u(10) }"
        @click="$emit('resume')"
      >
        {{ text.pause.resume }}
        <span class="hidden md:inline" :style="{ ...key, background: 'rgba(255,255,255,0.2)' }">P／Esc</span>
      </button>
      <button
        type="button"
        class="flex cursor-pointer items-center justify-center font-black text-sign"
        :style="{ minHeight: u(52), borderRadius: u(16), border: `${u(2)} solid #1d3a8f`, fontSize: u(18), gap: u(10) }"
        @click="$emit('restart')"
      >
        {{ text.pause.restart }}
        <span class="hidden bg-sign-tint md:inline" :style="key">R</span>
      </button>
      <button type="button" class="cursor-pointer font-bold text-muted" :style="{ minHeight: u(48), fontSize: u(16) }" @click="$emit('back')">
        {{ text.pause.back }}
      </button>
    </div>
    <p
      class="absolute text-center"
      :style="{ left: u(24), right: u(24), bottom: u(22), fontSize: u(14), color: '#e3e7ec', lineHeight: 1.6 }"
    >
      {{ text.pause.note }}
    </p>
  </div>
</template>
