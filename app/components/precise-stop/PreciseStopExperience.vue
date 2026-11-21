<script setup lang="ts">
import type { Component } from "vue";
import { BOARD_ID, EXPERIENCE } from "~/games/precise-stop/shared";
import type { Mode } from "@/lib/games/precise-stop/route";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";

/**
 * 介紹頁與遊戲畫面的切換。同一個網址：平常顯示介紹頁（預設插槽），
 * 按下出發後整頁換成遊戲畫面。遊戲畫面（含 Phaser、音效）按下出發才下載，介紹頁本身保持輕量。
 */
const { locale } = defineProps<{ locale: Locale }>();
const dict = getDictionary(locale);
const text = dict.preciseStop;

const playing = shallowRef<{ mode: Mode; key: number } | null>(null);
const stage = shallowRef<Component | null>(null);
/** 遊戲程式下載失敗（例如網路中斷）或畫面出錯時顯示重試，不會白畫面 */
const failed = ref(false);

async function load() {
  try {
    stage.value = markRaw((await import("./game/GameStage.vue")).default);
  } catch (error) {
    console.error(error);
    failed.value = true;
  }
}

function start(mode: Mode) {
  if (playing.value) return;
  playing.value = { mode, key: Date.now() };
  if (!stage.value) void load();
}

function retry() {
  if (!playing.value) return;
  failed.value = false;
  playing.value = { mode: playing.value.mode, key: Date.now() };
  if (!stage.value) void load();
}

function exit(scrollToBoard: boolean) {
  playing.value = null;
  failed.value = false;
  // 等介紹頁重新顯示後再捲動
  requestAnimationFrame(() => {
    if (scrollToBoard) document.getElementById(BOARD_ID)?.scrollIntoView({ block: "center" });
    else window.scrollTo({ top: 0 });
  });
}

onErrorCaptured((error) => {
  if (!playing.value) return;
  console.error(error);
  failed.value = true;
  return false;
});

provide(EXPERIENCE, { locale, dict, text, start });
</script>

<template>
  <slot />
  <template v-if="playing">
    <StageMessage v-if="failed">
      <div role="alert" data-testid="game-error" class="flex flex-col items-center gap-3">
        <p class="text-xl font-extrabold">{{ text.stage.errorTitle }}</p>
        <p class="text-[#c9cfd8]">{{ text.stage.errorBody }}</p>
        <div class="mt-2 flex flex-wrap justify-center gap-3">
          <button type="button" class="press min-h-12 cursor-pointer rounded-full bg-express px-8 text-lg font-bold" @click="retry">
            {{ text.stage.retry }}
          </button>
          <button
            type="button"
            class="min-h-12 cursor-pointer rounded-full px-6 font-bold ring-2 ring-inset ring-white/60"
            @click="exit(false)"
          >
            {{ text.stage.back }}
          </button>
        </div>
      </div>
    </StageMessage>
    <StageMessage v-else-if="!stage" />
    <component :is="stage" v-else :key="playing.key" :mode="playing.mode" :locale="locale" :text="text" @exit="exit" />
  </template>
</template>
