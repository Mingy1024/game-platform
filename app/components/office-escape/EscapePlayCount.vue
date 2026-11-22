<script setup lang="ts">
import { useExperience } from "~/games/office-escape/shared";
import { fmt, formatNumber } from "@/lib/i18n/format";

/** 累計下班次數（所有玩家）。計數需要後端，目前沒有資料來源，所以預設不顯示；開關打開時顯示版面示意（lib/flags.ts） */
const { text, locale, dict } = useExperience();
const enabled = useFlag("playCount");
const [before, after = ""] = text.playCount.split("{count}");
const sample = formatNumber(128406, locale);
</script>

<template>
  <span
    v-if="enabled"
    data-testid="play-count"
    :title="fmt(text.playCount, { count: sample })"
    class="inline-flex items-center gap-2 whitespace-nowrap rounded-full border-2 border-dashed border-[#a3adbd] bg-card py-1 pl-1 pr-3 text-sm font-bold"
  >
    <span class="flex size-7 items-center justify-center rounded-full bg-express text-white">
      <Icon name="clock" :size="16" />
    </span>
    <span>{{ before }}<strong class="text-base tabular-nums text-express">{{ sample }}</strong>{{ after }}</span>
    <span class="rounded-full bg-muted px-1.5 text-[10px] text-white">{{ dict.nav.reserved }}</span>
  </span>
</template>
