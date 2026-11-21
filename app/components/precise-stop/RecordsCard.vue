<script setup lang="ts">
import { useExperience } from "~/games/precise-stop/shared";
import { bestOf } from "@/lib/games/precise-stop/records";
import { taiwanDateKey } from "@/lib/games/precise-stop/route";
import { fmt, formatNumber, formatShortDate } from "@/lib/i18n/format";

const SAMPLE_PLAYERS = [
  ["Riku", "#cc4409", 5912, 5, 3],
  ["Mina", "#1d3a8f", 5874, 5, 12],
  ["Noa", "#16794f", 5801, 4, 60],
  ["Kai", "#a83606", 5766, 4, 70],
  ["Sora", "#4a5263", 5702, 4, 120],
  ["Rin", "#152b6b", 5655, 4, 130],
  ["Yui", "#cc4409", 5590, 3, 180],
  ["Leo", "#16794f", 5541, 3, 240],
  ["Hana", "#1d3a8f", 5498, 3, 300],
  ["Tomo", "#4a5263", 5460, 3, 360],
] as const;

/**
 * 我的紀錄，以及預留的「全站排行」分頁。
 * 排行榜還沒有後端，預設不顯示（lib/flags.ts），開關打開時顯示的是版面示意，資料是固定的樣本。
 * 登入開關打開時，卡片下方換成帳號區塊（RecordsAccount.vue）。
 */
const { text, locale, dict } = useExperience();
const records = useRecords();
const showRank = useFlag("leaderboard");
const showLogin = useFlag("login");
const tab = ref<"mine" | "rank">("mine");
const dateKey = useClientValue(taiwanDateKey);

const number = (value: number | null) => (value === null ? "—" : formatNumber(value, locale));
const daily = computed(() => bestOf(records.value, "daily", dateKey.value));
const tabClass = (active: boolean) =>
  `flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-1.5 px-2 font-bold ${
    active ? "font-extrabold text-sign shadow-[inset_0_-3px_0_var(--sign)]" : "text-muted"
  }`;

const stats = computed(() => [
  { label: text.records.dailyBest, value: number(daily.value), tint: "bg-edge-tint", testId: "record-daily" },
  { label: text.records.freeBest, value: number(records.value.free), tint: "bg-sign-tint", testId: "record-free" },
  {
    label: text.records.perfectStops,
    value: fmt(text.records.perfectCount, { count: formatNumber(records.value.perfectStops, locale) }),
    tint: "bg-platform",
    testId: "record-perfect",
  },
]);

const scopes = computed(() => [
  fmt(text.rank.daily, { date: dateKey.value ? formatShortDate(dateKey.value, locale) : "" }),
  text.rank.week,
  text.rank.free,
]);

const medal = (index: number) =>
  index === 0
    ? "bg-edge shadow-[inset_0_-3px_0_#b8860b]"
    : index === 1
      ? "bg-line shadow-[inset_0_-3px_0_#8a93a3]"
      : index === 2
        ? "bg-[#e8a06b] shadow-[inset_0_-3px_0_var(--express-deep)]"
        : "text-muted";
</script>

<template>
  <section aria-labelledby="records-title" data-testid="records-card" class="overflow-hidden rounded-[18px] border border-line bg-card">
    <div v-if="showRank" role="tablist" class="flex border-b border-line">
      <button
        id="records-title"
        type="button"
        role="tab"
        :aria-selected="tab === 'mine'"
        :class="tabClass(tab === 'mine')"
        @click="tab = 'mine'"
      >
        {{ text.records.tabMine }}
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="tab === 'rank'"
        data-testid="rank-tab"
        :class="tabClass(tab === 'rank')"
        @click="tab = 'rank'"
      >
        {{ text.records.tabRank }}
        <span class="rounded-full border-[1.5px] border-dashed border-[#a3adbd] px-2 text-xs text-muted">{{ dict.nav.reserved }}</span>
      </button>
    </div>
    <h2 v-else id="records-title" class="px-4 pt-4 text-xl font-extrabold text-ink">{{ text.records.tabMine }}</h2>

    <template v-if="tab === 'mine' || !showRank">
      <dl class="grid grid-cols-3 gap-2.5 p-4 pb-3">
        <div v-for="item in stats" :key="item.label" :class="`rounded-xl px-3 py-2.5 ${item.tint}`">
          <dt class="text-xs font-bold leading-snug text-muted">{{ item.label }}</dt>
          <dd class="mt-0.5 text-xl font-black tabular-nums sm:text-2xl" :data-testid="item.testId">{{ item.value }}</dd>
        </div>
      </dl>
      <RecordsAccount v-if="showLogin" :locale="locale" :labels="dict.account" :records="text.records" />
      <p v-else class="px-4 pb-4 text-sm text-muted">{{ text.records.deviceNote }}</p>
    </template>

    <div v-else data-testid="leaderboard">
      <div role="group" :aria-label="text.rank.scopeLabel" class="flex flex-wrap items-center gap-1.5 px-4 pb-1.5 pt-3">
        <button
          v-for="(label, index) in scopes"
          :key="label"
          type="button"
          :aria-pressed="index === 0"
          :disabled="index !== 0"
          :class="`min-h-9 rounded-full px-3.5 text-sm ${index === 0 ? 'bg-sign font-extrabold text-white' : 'bg-platform font-bold text-muted'}`"
        >
          {{ label }}
        </button>
        <span class="ml-auto hidden text-sm text-muted lg:block">{{ fmt(text.rank.updated, { count: formatNumber(3284, locale) }) }}</span>
      </div>
      <ol class="flex flex-col gap-0.5 px-2 pt-1">
        <li
          v-for="([name, color, score, perfect, minutes], index) in SAMPLE_PLAYERS"
          :key="name"
          :class="`flex min-h-12 items-center gap-2.5 rounded-xl px-3 ${index < 3 ? 'bg-[#fff9e6]' : ''} ${index >= 7 ? 'max-lg:hidden' : ''}`"
        >
          <span :class="`flex size-[30px] shrink-0 items-center justify-center rounded-full text-[15px] font-black tabular-nums ${medal(index)}`">
            {{ index + 1 }}
          </span>
          <span
            aria-hidden="true"
            class="flex size-[30px] shrink-0 items-center justify-center rounded-full text-sm font-black text-white"
            :style="{ background: color }"
          >
            {{ name[0] }}
          </span>
          <span class="flex min-w-0 flex-1 flex-col leading-tight">
            <span class="truncate font-extrabold">{{ name }}</span>
            <span class="hidden text-xs text-muted lg:block">
              {{
                minutes < 60
                  ? fmt(text.rank.minutesAgo, { count: minutes })
                  : fmt(text.rank.hoursAgo, { count: Math.round(minutes / 60) })
              }}
            </span>
          </span>
          <span class="text-sm font-bold text-signal" :title="text.rank.perfectStops">★ {{ perfect }}</span>
          <span class="w-16 text-right text-[17px] font-black tabular-nums">{{ formatNumber(score, locale) }}</span>
        </li>
      </ol>
      <button type="button" disabled class="mx-auto block min-h-10 px-3.5 text-sm font-bold text-sign lg:hidden">
        {{ text.rank.viewTop }}
      </button>
      <div class="mx-4 mb-4 mt-1.5 flex min-h-13 items-center gap-2.5 rounded-xl bg-edge-tint px-3 py-2.5 text-sm">
        <p class="min-w-0 flex-1 leading-snug">
          <strong>{{ daily === null ? text.records.none : fmt(text.rank.yourBest, { score: number(daily) }) }}</strong>
          <br >
          <span class="text-muted">{{ text.rank.loginToRank }}</span>
        </p>
      </div>
    </div>
  </section>
</template>
