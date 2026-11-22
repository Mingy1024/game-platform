<script setup lang="ts">
import { useExperience } from "~/games/precise-stop/shared";
import { readConsent, subscribeConsent } from "@/lib/account/leaderboard-consent";
import { refreshMe } from "@/lib/account/me-store";
import { nickParts, nickText, type Nick } from "@/lib/account/nick/nick";
import { joinLeaderboard } from "@/lib/games/precise-stop/account-sync";
import { AVATAR_COLORS, TOP_PREVIEW, type MineResponse, type Scope, type TopResponse } from "@/lib/games/precise-stop/leaderboard";
import { fetchMine, fetchTop, localBest } from "@/lib/games/precise-stop/leaderboard-client";
import { taiwanDateKey } from "@/lib/games/precise-stop/route";
import { fmt, formatNumber, formatShortDate } from "@/lib/i18n/format";

/**
 * 「我的紀錄」卡的第二個分頁「全站排行」（精準停車設計稿第 14.4 節，第 28、29、33 張；T1–T7、T12）。
 * 三張榜各自讀一次前 100 名（伺服器快取 60 秒），切回來不重讀；讀不到時顯示「再試一次」，不自動重試。
 * 最下面「你的名次」每次現算：切榜、身分換了、紀錄更新（剛同步完）時重讀。
 */
const { text, locale, dict } = useExperience();
const me = useMe();
const records = useRecords();
const consent = useExternalStore(subscribeConsent, readConsent, null);
const dateKey = useClientValue(taiwanDateKey);

const scope = ref<Scope>("daily");
const tops = ref<Partial<Record<Scope, TopResponse | "error" | "loading">>>({});
const expanded = ref(false);
const mine = ref<MineResponse | "loading" | null>("loading");

async function loadTop(target: Scope) {
  tops.value = { ...tops.value, [target]: "loading" };
  const result = await fetchTop(target);
  tops.value = { ...tops.value, [target]: result ?? "error" };
}

const top = computed(() => tops.value[scope.value]);
const rows = computed(() => {
  const value = top.value;
  if (!value || typeof value === "string") return [];
  return expanded.value ? value.rows : value.rows.slice(0, TOP_PREVIEW);
});

/** 目前的身分（Google 帳號或訪客）；都沒有是 null */
const identity = computed<{ id: string; nick: Nick; guest: boolean } | null>(() => {
  const value = me.value;
  if (value.status === "loggedIn") return { id: value.playerId, nick: value.nick, guest: false };
  if (value.status === "loggedOut" && value.guest) return { id: value.guest.playerId, nick: value.guest.nick, guest: true };
  return null;
});

let mineTicket = 0;
async function loadMine() {
  const who = identity.value;
  const ticket = ++mineTicket;
  if (!who) return;
  mine.value = "loading";
  const result = await fetchMine(scope.value, who.id);
  if (ticket !== mineTicket) return;
  if (result === "mismatch") {
    // 另一個分頁換了身分：重新讀登入狀態，identity 變了會再讀一次
    mine.value = null;
    void refreshMe({ keepOnError: true });
    return;
  }
  mine.value = result;
}

onMounted(() => {
  void loadTop(scope.value);
  void loadMine();
});
watch(scope, (value) => {
  expanded.value = false;
  const current = tops.value[value];
  if (!current || current === "error") void loadTop(value);
});
watch([scope, () => identity.value?.id, records], () => void loadMine());

const scopes = computed(() => [
  { id: "daily" as const, label: fmt(text.rank.daily, { date: dateKey.value ? formatShortDate(dateKey.value, locale) : "" }) },
  { id: "week" as const, label: text.rank.week },
  { id: "free" as const, label: text.rank.free },
]);
const updatedText = computed(() => {
  const value = top.value;
  if (!value || typeof value === "string") return "";
  const template = scope.value === "daily" ? text.rank.updatedDaily : scope.value === "week" ? text.rank.updatedWeek : text.rank.updatedFree;
  return fmt(template, { count: formatNumber(value.total, locale) });
});

const number = (value: number) => formatNumber(value, locale);
const badge = "shrink-0 rounded-full border border-[#a3adbd] px-[7px] text-[11px] font-bold leading-[18px] text-muted";
const initial = (nick: Nick) => Array.from(nickParts(nick, locale).name)[0] ?? "?";

function ago(iso: string) {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return fmt(text.rank.minutesAgo, { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return fmt(text.rank.hoursAgo, { count: hours });
  return fmt(text.rank.daysAgo, { count: Math.floor(hours / 24) });
}

const medal = (index: number) =>
  index === 0
    ? "bg-edge shadow-[inset_0_-3px_0_#b8860b]"
    : index === 1
      ? "bg-line shadow-[inset_0_-3px_0_#8a93a3]"
      : index === 2
        ? "bg-[#e8a06b] shadow-[inset_0_-3px_0_var(--express-deep)]"
        : "text-muted";

/** 「你的名次」那一列要顯示哪一種（第 33 張的五種狀態，加上讀取中、讀不到名次） */
const myRow = computed(() => {
  const who = identity.value;
  const value = me.value;
  if (!who) {
    if (value.status !== "loggedOut") return { kind: "hidden" as const };
    if (value.consentRequired && consent.value === "no") return { kind: "declined" as const };
    return { kind: "join" as const };
  }
  const result = mine.value;
  const best = { daily: text.rank.bestDaily, week: text.rank.bestWeek, free: text.rank.bestFree }[scope.value];
  const none = { daily: text.rank.noneDaily, week: text.rank.noneWeek, free: text.rank.noneFree }[scope.value];
  if (result === "loading") return { kind: "loading" as const, who };
  if (result === null) {
    // 讀不到名次：只顯示自己的最佳分（T7）
    const score = localBest(records.value, scope.value);
    return score === null
      ? { kind: "none" as const, who, note: none }
      : { kind: "ranked" as const, who, rank: null, score, note: fmt(best, { score: number(score) }) };
  }
  if (result.rank === null || result.score === null) return { kind: "none" as const, who, note: none };
  return {
    kind: "ranked" as const,
    who,
    rank: result.rank,
    score: result.score,
    note: result.toTop100 !== null ? fmt(text.rank.toTop, { points: number(result.toTop100) }) : fmt(best, { score: number(result.score) }),
  };
});
</script>

<template>
  <div data-testid="leaderboard">
    <div role="group" :aria-label="text.rank.scopeLabel" class="flex flex-wrap items-center gap-1.5 px-4 pb-1.5 pt-3">
      <button
        v-for="item in scopes"
        :key="item.id"
        type="button"
        :aria-pressed="scope === item.id"
        :data-testid="`rank-scope-${item.id}`"
        :class="`press min-h-9 cursor-pointer rounded-full px-3.5 text-sm ${scope === item.id ? 'bg-sign font-extrabold text-white' : 'bg-platform font-bold text-muted'}`"
        @click="scope = item.id"
      >
        {{ item.label }}
      </button>
      <span v-if="updatedText" data-testid="rank-updated" class="ml-auto hidden text-sm text-muted lg:block">{{ updatedText }}</span>
    </div>

    <div v-if="!top || top === 'loading'" :aria-label="text.rank.loading" role="status" class="flex flex-col gap-0.5 px-2 pt-1" data-testid="rank-loading">
      <div v-for="index in 5" :key="index" class="mx-1 my-1 h-10 animate-pulse rounded-xl bg-platform motion-reduce:animate-none" />
    </div>

    <div v-else-if="top === 'error'" role="alert" data-testid="rank-error" class="mx-4 my-3 flex flex-wrap items-center gap-3 rounded-xl bg-platform px-3.5 py-3">
      <p class="min-w-0 flex-1 font-bold">{{ text.rank.loadError }}</p>
      <button type="button" class="press min-h-11 cursor-pointer rounded-full border border-line bg-card px-4 font-bold text-sign" data-testid="rank-retry" @click="loadTop(scope)">
        {{ text.rank.retry }}
      </button>
    </div>

    <p v-else-if="top.rows.length === 0" data-testid="rank-empty" class="px-4 py-4 text-muted">{{ text.rank.empty }}</p>

    <template v-else>
      <ol :aria-label="fmt(text.rank.listLabel, { count: rows.length })" class="flex flex-col gap-0.5 px-2 pt-1" data-testid="rank-rows">
        <li
          v-for="(row, index) in rows"
          :key="row.rank"
          data-testid="rank-row"
          :data-guest="row.guest"
          :class="`flex min-h-12 items-center gap-2.5 rounded-xl px-3 ${index < 3 ? 'bg-[#fff9e6]' : ''}`"
        >
          <span :class="`flex size-[30px] shrink-0 items-center justify-center rounded-full text-[15px] font-black tabular-nums ${medal(index)}`">
            {{ row.rank }}
          </span>
          <span
            aria-hidden="true"
            class="flex size-[30px] shrink-0 items-center justify-center rounded-full text-sm font-black text-white"
            :style="{ background: AVATAR_COLORS[row.color % AVATAR_COLORS.length] }"
          >
            {{ initial(row.nick) }}
          </span>
          <!-- 手機寬度不夠：訪客標籤放第二行（電腦版第二行是多久以前，標籤跟在暱稱後面） -->
          <span class="flex min-w-0 flex-1 flex-col leading-tight">
            <span class="flex min-w-0 items-center gap-1.5">
              <NickName :nick="row.nick" :locale="locale" class="truncate" number-class="text-[13px]" />
              <span v-if="row.guest" data-testid="guest-badge" :class="`${badge} hidden lg:inline-block`">{{ text.rank.guest }}</span>
            </span>
            <span v-if="row.guest" data-testid="guest-badge" :class="`${badge} mt-0.5 self-start lg:hidden`">{{ text.rank.guest }}</span>
            <span class="hidden text-xs text-muted lg:block">{{ ago(row.achievedAt) }}</span>
          </span>
          <span class="w-16 shrink-0 text-right text-[17px] font-black tabular-nums">{{ number(row.score) }}</span>
        </li>
      </ol>
      <button
        v-if="!expanded && top.rows.length > TOP_PREVIEW"
        type="button"
        data-testid="rank-expand"
        class="mx-auto block min-h-11 cursor-pointer px-3.5 text-sm font-bold text-sign"
        @click="expanded = true"
      >
        {{ text.rank.viewTop }}
      </button>
    </template>

    <div class="mx-4 mb-4 mt-1.5 border-t border-dashed border-line pt-1.5" data-testid="rank-mine" :data-kind="myRow.kind">
      <div
        v-if="myRow.kind === 'ranked' || myRow.kind === 'loading'"
        class="flex min-h-13 items-center gap-2.5 rounded-xl bg-sign px-3.5 py-2 text-white"
      >
        <span class="min-w-11 text-center text-sm font-black tabular-nums" data-testid="rank-mine-rank">
          {{ myRow.kind === "ranked" && myRow.rank !== null ? `#${number(myRow.rank)}` : "—" }}
        </span>
        <span class="flex min-w-0 flex-1 flex-col leading-snug">
          <span class="flex min-w-0 flex-wrap items-center gap-x-1.5 text-[15px] font-black">
            <span class="min-w-0 break-words">{{ fmt(text.rank.you, { name: nickText(myRow.who.nick, locale) }) }}</span>
            <span v-if="myRow.who.guest" data-testid="guest-badge" class="shrink-0 rounded-full border border-[#c9cfd8] px-[7px] text-[11px] font-bold leading-[18px]">{{ text.rank.guest }}</span>
          </span>
          <span class="text-xs text-[#c9cfd8]" data-testid="rank-mine-note">{{ myRow.kind === "ranked" ? myRow.note : "" }}&nbsp;</span>
        </span>
        <span v-if="myRow.kind === 'ranked'" class="shrink-0 text-[17px] font-black tabular-nums text-edge">{{ number(myRow.score) }}</span>
      </div>

      <div v-else-if="myRow.kind === 'none'" class="flex min-h-13 items-center gap-2.5 rounded-xl bg-sign-tint px-3.5 py-2">
        <span class="min-w-11 text-center text-sm font-black text-muted">—</span>
        <span class="flex min-w-0 flex-1 flex-col leading-snug">
          <span class="flex min-w-0 flex-wrap items-center gap-x-1.5 text-[15px] font-black">
            <span class="min-w-0 break-words">{{ fmt(text.rank.you, { name: nickText(myRow.who.nick, locale) }) }}</span>
            <span v-if="myRow.who.guest" data-testid="guest-badge" class="shrink-0 rounded-full border border-[#a3adbd] px-[7px] text-[11px] font-bold leading-[18px] text-muted">{{ text.rank.guest }}</span>
          </span>
          <span class="text-xs text-muted" data-testid="rank-mine-note">{{ myRow.note }}</span>
        </span>
      </div>

      <div v-else-if="myRow.kind === 'join'" class="flex flex-wrap items-center gap-3 rounded-[14px] bg-edge-tint px-3.5 py-3">
        <p class="min-w-[12rem] flex-1 text-sm leading-normal">
          <strong>{{ text.records.rankHint }}</strong>
          <br >
          <span class="text-muted">{{ text.records.rankLoginHint }}</span>
        </p>
        <LoginButton :labels="dict.account" />
      </div>

      <div v-else-if="myRow.kind === 'declined'" class="flex flex-wrap items-center gap-3 rounded-[14px] border border-line bg-platform px-3.5 py-3">
        <p class="min-w-[12rem] flex-1 text-sm font-bold leading-normal">{{ text.rank.declined }}</p>
        <button type="button" data-testid="rank-rejoin" class="press min-h-11 cursor-pointer rounded-full border border-line bg-card px-4 text-sm font-bold text-sign" @click="joinLeaderboard">
          {{ text.rank.rejoin }}
        </button>
      </div>
    </div>
  </div>
</template>
