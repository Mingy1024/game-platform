<script setup lang="ts">
import { useExperience } from "~/games/mine-descent/shared";
import { formatNumber } from "@/lib/i18n/format";

/** 我的紀錄，以及「全站排行」分頁（排行榜開關打開時）。登入開關打開時，卡片下方換成帳號區塊（RecordsAccount.vue） */
const { text, locale, dict } = useExperience();
const records = useMineRecords();
const rankFlag = useFlag("leaderboard");
const showLogin = useFlag("login");
// 排行榜要有帳號系統（訪客、名次 API 都在登入功能底下）
const showRank = computed(() => rankFlag.value && showLogin.value);
const tab = ref<"mine" | "rank">("mine");

const number = (value: number | null) => (value === null ? "—" : formatNumber(value, locale));
const tabClass = (active: boolean) =>
  `flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-1.5 px-2 font-bold ${
    active ? "font-extrabold text-sign shadow-[inset_0_-3px_0_var(--sign)]" : "text-muted"
  }`;

const stats = computed(() => [
  { label: text.records.bestDepth, value: number(records.value.depth), unit: text.hud.unit, tint: "bg-edge-tint", testId: "record-depth" },
  { label: text.records.bestScore, value: number(records.value.score), unit: "", tint: "bg-sign-tint", testId: "record-score" },
]);
</script>

<template>
  <section aria-labelledby="records-title" data-testid="records-card" class="overflow-hidden rounded-[18px] border border-line bg-card">
    <div v-if="showRank" role="tablist" class="flex border-b border-line">
      <button id="records-title" type="button" role="tab" :aria-selected="tab === 'mine'" :class="tabClass(tab === 'mine')" @click="tab = 'mine'">
        {{ text.records.tabMine }}
      </button>
      <button type="button" role="tab" :aria-selected="tab === 'rank'" data-testid="rank-tab" :class="tabClass(tab === 'rank')" @click="tab = 'rank'">
        {{ text.records.tabRank }}
      </button>
    </div>
    <h2 v-else id="records-title" class="px-4 pt-4 text-xl font-extrabold text-ink">{{ text.records.tabMine }}</h2>

    <template v-if="tab === 'mine' || !showRank">
      <dl class="grid grid-cols-2 gap-2.5 p-4 pb-3">
        <div v-for="item in stats" :key="item.label" :class="`rounded-xl px-3 py-2.5 ${item.tint}`">
          <dt class="text-xs font-bold leading-snug text-muted">{{ item.label }}</dt>
          <dd class="mt-0.5 text-xl font-black tabular-nums sm:text-2xl" :data-testid="item.testId">
            {{ item.value }}<span v-if="item.unit && item.value !== '—'" class="ml-1 text-sm font-bold text-muted">{{ item.unit }}</span>
          </dd>
        </div>
      </dl>
      <RecordsAccount v-if="showLogin" :locale="locale" :labels="dict.account" :records="text.records" />
      <p v-else class="px-4 pb-4 text-sm text-muted">{{ text.records.deviceNote }}</p>
    </template>

    <MineLeaderboard v-else />
  </section>
</template>
