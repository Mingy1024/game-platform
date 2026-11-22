<script setup lang="ts">
import type { Component } from "vue";
import { BOARD_ID, EXPERIENCE } from "~/games/office-escape/shared";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";

/**
 * 介紹頁與遊戲畫面的切換。同一個網址：平常顯示介紹頁（預設插槽），
 * 按下出發後整頁換成遊戲畫面。遊戲畫面（含 three.js、音效）按下出發才下載，介紹頁本身保持輕量（N5）。
 */
const { locale } = defineProps<{ locale: Locale }>();
const dict = getDictionary(locale);
const text = dict.officeEscape;

const playing = shallowRef<{ key: number } | null>(null);
const stage = shallowRef<Component | null>(null);
/** 遊戲程式下載失敗（例如網路中斷）或畫面出錯時顯示重試，不會白畫面 */
const failed = ref(false);

async function load() {
  try {
    stage.value = markRaw((await import("./game/EscapeStage.vue")).default);
  } catch (error) {
    console.error(error);
    failed.value = true;
  }
}

function start() {
  if (playing.value) return;
  playing.value = { key: Date.now() };
  if (!stage.value) void load();
}

function retry() {
  if (!playing.value) return;
  failed.value = false;
  playing.value = { key: Date.now() };
  if (!stage.value) void load();
}

function exit() {
  playing.value = null;
  failed.value = false;
  requestAnimationFrame(() => window.scrollTo({ top: 0 }));
}

onErrorCaptured((error) => {
  if (!playing.value) return;
  console.error(error);
  failed.value = true;
  return false;
});

provide(EXPERIENCE, { locale, dict, text, start });
void BOARD_ID;
</script>

<template>
  <slot />
  <template v-if="playing">
    <StageMessage v-if="failed">
      <div role="alert" data-testid="game-error" class="flex flex-col items-center gap-3">
        <p class="text-xl font-extrabold">{{ dict.preciseStop.stage.errorTitle }}</p>
        <p class="text-[#c9cfd8]">{{ dict.preciseStop.stage.errorBody }}</p>
        <div class="mt-2 flex flex-wrap justify-center gap-3">
          <button type="button" class="press min-h-12 cursor-pointer rounded-full bg-express px-8 text-lg font-bold" @click="retry">
            {{ dict.preciseStop.stage.retry }}
          </button>
          <button type="button" class="min-h-12 cursor-pointer rounded-full px-6 font-bold ring-2 ring-inset ring-white/60" @click="exit">
            {{ dict.preciseStop.stage.back }}
          </button>
        </div>
      </div>
    </StageMessage>
    <StageMessage v-else-if="!stage" />
    <component :is="stage" v-else :key="playing.key" :locale="locale" :text="text" :dict="dict" @exit="exit" />
  </template>
</template>
