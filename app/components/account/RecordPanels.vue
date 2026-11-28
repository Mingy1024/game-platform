<script setup lang="ts">
import { bestOf } from "@/lib/games/precise-stop/records";
import { taiwanDateKey } from "@/lib/games/precise-stop/route";
import { fmt, formatNumber } from "@/lib/i18n/format";
import { todayBest } from "@/lib/games/office-escape/records";
import { t } from "@/lib/i18n/zh-TW";

/**
 * 我的紀錄頁的「最佳紀錄」區塊，列出精準停車（帳號設計稿第 19 題）：登入時是帳號的紀錄，沒登入是這台裝置的（同一份 useRecords）。
 * 「最近玩過」「收藏」不做（2026-11-22 決定，T21）。
 */

const text = t.preciseStop.records;
const records = useRecords();
const escape = useEscapeRecords();
const mine = useMineRecords();
const monk = useMonkRecords();
const dateKey = useClientValue(taiwanDateKey);
const daily = computed(() => bestOf(records.value, "daily", dateKey.value));
const hasAny = computed(
  () => records.value.free !== null || Object.keys(records.value.daily).length > 0 || records.value.perfectStops > 0,
);
const escapeHasAny = computed(() => escape.value.best !== null || Object.keys(escape.value.daily).length > 0);
const mineHasAny = computed(() => mine.value.score !== null || mine.value.depth !== null);
const mineStats = computed(() => [
  { label: "最深", value: mine.value.depth === null ? "—" : `${formatNumber(mine.value.depth, "zh-TW")} 公尺`, testId: "me-mine-depth" },
  { label: "最高分", value: number(mine.value.score), testId: "me-mine-score" },
]);
const monkHasAny = computed(() => monk.value.fixed !== null || monk.value.random !== null);
const monkStats = computed(() => [
  { label: "固定關卡", value: number(monk.value.fixed?.score ?? null), testId: "me-monk-fixed" },
  { label: "隨機模式", value: number(monk.value.random?.score ?? null), testId: "me-monk-random" },
]);
const escapeStats = computed(() => [
  { label: "今日最佳", value: number(todayBest(escape.value)), testId: "me-escape-daily" },
  { label: "歷史最佳", value: number(escape.value.best), testId: "me-escape-best" },
]);
const number = (value: number | null) => (value === null ? "—" : formatNumber(value, "zh-TW"));
const stats = computed(() => [
  { label: "今日挑戰", value: number(daily.value), testId: "me-best-daily" },
  { label: "自由模式", value: number(records.value.free), testId: "me-best-free" },
  {
    label: text.perfectStops,
    value: fmt(text.perfectCount, { count: formatNumber(records.value.perfectStops, "zh-TW") }),
    testId: "me-best-perfect",
  },
]);
</script>

<template>
  <div class="mt-10 max-w-xl">
    <section aria-labelledby="bests-title" data-testid="me-bests" class="flex flex-col gap-3 rounded-2xl border border-line bg-card p-5">
      <h2 id="bests-title" class="flex items-center gap-2 text-xl font-extrabold text-ink">
        <Icon name="restart" :size="24" class="text-sign" />
        最佳紀錄
      </h2>
      <NuxtLink
        v-if="hasAny"
        to="/games/precise-stop"
        data-testid="me-bests-precise-stop"
        class="press flex flex-col gap-2.5 rounded-[14px] bg-platform p-3.5 text-ink"
      >
        <span class="flex items-center gap-2.5">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sign text-white">
            <Icon name="train" :size="22" />
          </span>
          <span class="min-w-0 flex-1 text-lg font-black text-sign">{{ t.preciseStop.title }}</span>
          <Icon name="right" :size="18" class="text-muted" />
        </span>
        <dl class="grid grid-cols-3 gap-1.5">
          <div v-for="stat in stats" :key="stat.testId" class="min-w-0">
            <dt class="text-[13px] font-bold text-muted">{{ stat.label }}</dt>
            <dd :data-testid="stat.testId" class="text-xl font-black tabular-nums">{{ stat.value }}</dd>
          </div>
        </dl>
      </NuxtLink>
      <NuxtLink
        v-if="escapeHasAny"
        to="/games/office-escape"
        data-testid="me-bests-office-escape"
        class="press flex flex-col gap-2.5 rounded-[14px] bg-platform p-3.5 text-ink"
      >
        <span class="flex items-center gap-2.5">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sign text-white">
            <Icon name="clock" :size="22" />
          </span>
          <span class="min-w-0 flex-1 text-lg font-black text-sign">{{ t.officeEscape.title }}</span>
          <Icon name="right" :size="18" class="text-muted" />
        </span>
        <dl class="grid grid-cols-2 gap-1.5">
          <div v-for="stat in escapeStats" :key="stat.testId" class="min-w-0">
            <dt class="text-[13px] font-bold text-muted">{{ stat.label }}</dt>
            <dd :data-testid="stat.testId" class="text-xl font-black tabular-nums">{{ stat.value }}</dd>
          </div>
        </dl>
      </NuxtLink>
      <NuxtLink
        v-if="mineHasAny"
        to="/games/mine-descent"
        data-testid="me-bests-mine-descent"
        class="press flex flex-col gap-2.5 rounded-[14px] bg-platform p-3.5 text-ink"
      >
        <span class="flex items-center gap-2.5">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sign text-white">
            <Icon name="down" :size="22" />
          </span>
          <span class="min-w-0 flex-1 text-lg font-black text-sign">{{ t.mineDescent.title }}</span>
          <Icon name="right" :size="18" class="text-muted" />
        </span>
        <dl class="grid grid-cols-2 gap-1.5">
          <div v-for="stat in mineStats" :key="stat.testId" class="min-w-0">
            <dt class="text-[13px] font-bold text-muted">{{ stat.label }}</dt>
            <dd :data-testid="stat.testId" class="text-xl font-black tabular-nums">{{ stat.value }}</dd>
          </div>
        </dl>
      </NuxtLink>
      <NuxtLink
        v-if="monkHasAny"
        to="/games/monk-soup-tower"
        data-testid="me-bests-monk-soup-tower"
        class="press flex flex-col gap-2.5 rounded-[14px] bg-platform p-3.5 text-ink"
      >
        <span class="flex items-center gap-2.5">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sign text-white">
            <Icon name="star" :size="22" />
          </span>
          <span class="min-w-0 flex-1 text-lg font-black text-sign">{{ t.monkSoupTower.title }}</span>
          <Icon name="right" :size="18" class="text-muted" />
        </span>
        <dl class="grid grid-cols-2 gap-1.5">
          <div v-for="stat in monkStats" :key="stat.testId" class="min-w-0">
            <dt class="text-[13px] font-bold text-muted">{{ stat.label }}</dt>
            <dd :data-testid="stat.testId" class="text-xl font-black tabular-nums">{{ stat.value }}</dd>
          </div>
        </dl>
      </NuxtLink>
      <p v-if="!hasAny && !escapeHasAny && !mineHasAny && !monkHasAny" class="text-muted">還沒有紀錄。完成一局之後，每款遊戲的最佳成績會留在這裡。</p>
    </section>
  </div>
</template>
