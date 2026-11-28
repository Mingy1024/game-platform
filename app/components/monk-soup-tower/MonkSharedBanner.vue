<script setup lang="ts">
import { useExperience } from "~/games/monk-soup-tower/shared";
import { decodeRun } from "@/lib/games/monk-soup-tower/share-code";

/** 成績連結上方朋友的成績（J5）；隨機模式多一顆「挑戰同一座塔」，用同一個塔號開始（J7） */
const props = defineProps<{ banner: string; code: string }>();
const { text, start } = useExperience();
const run = decodeRun(props.code);
const seed = run?.mode === "random" ? run.seed : null;
</script>

<template>
  <div data-testid="shared-banner" class="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-edge bg-edge-tint px-4 py-3 font-bold text-ink">
    <p class="min-w-0 flex-1">{{ props.banner }}</p>
    <button
      v-if="seed !== null"
      type="button"
      data-testid="challenge-same"
      class="press min-h-11 cursor-pointer rounded-full bg-[#a8372c] px-4 font-extrabold text-white"
      @click="start('random', seed)"
    >
      {{ text.shared.challenge }}
    </button>
  </div>
</template>
