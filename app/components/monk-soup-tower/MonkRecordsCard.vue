<script setup lang="ts">
import { seconds, useExperience } from "~/games/monk-soup-tower/shared";
import { SUMMIT_FLOOR } from "@/lib/games/monk-soup-tower/records";
import { MODES } from "@/lib/games/monk-soup-tower/tower";
import { fmt, formatNumber } from "@/lib/i18n/format";

/** 我的紀錄（J1），以及「全站排行」分頁（排行榜開關打開時，T13）。登入開關打開時，卡片下方換成帳號區塊 */
const { text, locale, dict } = useExperience();
const records = useMonkRecords();
const rankFlag = useFlag("leaderboard");
const showLogin = useFlag("login");
const showRank = computed(() => rankFlag.value && showLogin.value);
const tab = ref<"mine" | "rank">("mine");

const tabClass = (active: boolean) =>
  `flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-1.5 px-2 font-bold ${active ? "font-extrabold text-sign shadow-[inset_0_-3px_0_var(--sign)]" : "text-muted"}`;

const floorText = (floor: number | null) => (floor === null ? "—" : floor >= SUMMIT_FLOOR ? text.records.summit : text.floorNames[floor - 1]!);
const rows = computed(() =>
  MODES.map((mode) => {
    const best = records.value[mode];
    return {
      mode,
      name: text.modes[mode],
      score: best ? formatNumber(best.score, locale) : "—",
      time: best ? fmt(text.board.bestTime, { time: seconds(best.timeMs, locale) }) : "—",
      floor: floorText(records.value.floors[mode]),
    };
  }),
);
</script>

<template>
  <section aria-labelledby="records-title" data-testid="records-card" class="overflow-hidden rounded-[18px] border border-line bg-card">
    <div v-if="showRank" role="tablist" class="flex border-b border-line">
      <button id="records-title" type="button" role="tab" :aria-selected="tab === 'mine'" :class="tabClass(tab === 'mine')" @click="tab = 'mine'">{{ text.records.tabMine }}</button>
      <button type="button" role="tab" :aria-selected="tab === 'rank'" data-testid="rank-tab" :class="tabClass(tab === 'rank')" @click="tab = 'rank'">{{ text.records.tabRank }}</button>
    </div>
    <h2 v-else id="records-title" class="px-4 pt-4 text-xl font-extrabold text-ink">{{ text.records.tabMine }}</h2>

    <template v-if="tab === 'mine' || !showRank">
      <table class="mx-4 my-3 w-[calc(100%-2rem)] text-sm">
        <thead>
          <tr class="text-left text-xs text-muted">
            <th scope="col" class="py-1 pr-2 font-bold"><span class="sr-only">{{ text.modes.fixed }}／{{ text.modes.random }}</span></th>
            <th scope="col" class="py-1 pr-2 font-bold">{{ text.records.bestScore }}</th>
            <th scope="col" class="py-1 pr-2 font-bold">{{ text.records.bestTime }}</th>
            <th scope="col" class="py-1 font-bold">{{ text.records.bestFloor }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.mode" class="border-t border-line" :data-testid="`record-${row.mode}`">
            <th scope="row" class="py-2 pr-2 text-left font-extrabold">{{ row.name }}</th>
            <td class="py-2 pr-2 text-xl font-black tabular-nums" :data-testid="`record-${row.mode}-score`">{{ row.score }}</td>
            <td class="py-2 pr-2 tabular-nums text-muted">{{ row.time }}</td>
            <td class="py-2 font-bold" :data-testid="`record-${row.mode}-floor`">{{ row.floor }}</td>
          </tr>
        </tbody>
      </table>
      <RecordsAccount v-if="showLogin" :locale="locale" :labels="dict.account" :records="text.records" />
      <p v-else class="px-4 pb-4 text-sm text-muted">{{ text.records.deviceNote }}</p>
    </template>

    <MonkLeaderboard v-else />
  </section>
</template>
