<script setup lang="ts">
import { u, useGame } from "~/games/office-escape/shared";
import { readConsent, subscribeConsent } from "@/lib/account/leaderboard-consent";
import { FLAGS } from "@/lib/flags";
import { declineLeaderboard, joinLeaderboard } from "@/lib/games/office-escape/account-sync";
import type { SaveOutcome } from "@/lib/games/office-escape/records";
import { clockFromTenths } from "@/lib/games/office-escape/share-code";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fmt, formatDecimal, formatNumber } from "@/lib/i18n/format";

/** 結算（C1–C3）：結局、總分、各項得分、紀錄、上榜詢問（歐盟）、分享與再玩一次 */
const props = defineProps<{ outcome: SaveOutcome | null; newLines: number; base: Dictionary["preciseStop"] }>();
defineEmits<{ share: []; again: []; back: [] }>();
const game = useGame();
const text = computed(() => game.value.text);
const locale = computed(() => game.value.locale);
const result = computed(() => game.value.snapshot.value.result);
const ending = computed(() => (result.value?.hidden ? text.value.final.endings.hidden : result.value ? text.value.final.endings[result.value.ending] : null));
const multiplier = computed(() => (result.value ? { fast: 2, ontime: 1.5, overtime: 1 }[result.value.ending] : 1));
const clock = computed(() => (result.value ? clockFromTenths(Math.round((result.value.clockTicks / 120) * 10)) : ""));
const accent = computed(() => ({ fast: "#4fd69c", ontime: "#ffc83d", overtime: "#ff8a57" })[result.value?.ending ?? "ontime"]);
const parts = computed(() => (["time", "graze", "event", "item"] as const).map((key) => ({ key, label: text.value.final.parts[key], value: result.value?.parts[key] ?? 0 })));

const me = useMe();
const consent = useExternalStore(subscribeConsent, readConsent, null);
const askConsent = computed(
  () => FLAGS.login && FLAGS.leaderboard && me.value.status === "loggedOut" && !me.value.guest && me.value.consentRequired && consent.value === null,
);

function recordText(outcome: SaveOutcome) {
  const t = text.value;
  const total = result.value?.total ?? 0;
  if (!outcome.isNewRecord) return fmt(t.final.best, { score: formatNumber(outcome.previousBest ?? total, locale.value) });
  return `${t.final.newRecord} ${
    outcome.previousBest === null
      ? t.final.firstRecord
      : fmt(t.final.recordChange, { from: formatNumber(outcome.previousBest, locale.value), to: formatNumber(total, locale.value) })
  }`;
}
const pill = (background: string, color = "#fff") => ({
  padding: `${u(4)} ${u(12)}`,
  borderRadius: "999px",
  background,
  color,
  fontSize: u(14),
  fontWeight: 900,
});
const button = (background: string, shadow: string) => ({ minHeight: u(48), borderRadius: u(16), background, boxShadow: `0 ${u(4)} 0 ${shadow}`, fontSize: u(17) });
</script>

<template>
  <div v-if="result && ending" data-testid="final-panel" :data-ending="result.hidden ? 'hidden' : result.ending" data-no-brake class="absolute inset-0 flex flex-col overflow-y-auto bg-canvas" :style="{ padding: `${u(14)} ${u(20)}`, gap: u(8) }">
    <div class="flex items-center justify-between" :style="{ gap: u(8) }">
      <span :style="pill('#cc4409')">{{ text.title }}</span>
      <div class="flex shrink-0" :style="{ gap: u(6) }"><EscapeSoundButtons :labels="base.stage" /></div>
    </div>
    <div class="flex flex-col items-center text-center" :style="{ gap: u(2) }">
      <h2 data-testid="ending-title" :style="{ fontSize: u(26), fontWeight: 900, color: accent, lineHeight: 1.2 }">{{ ending.title }}</h2>
      <p v-if="result.hidden" :style="{ fontSize: u(13), color: '#aab3c5' }">{{ ending.body }}</p>
      <span :style="{ fontSize: u(14), fontWeight: 700, color: '#aab3c5', marginTop: u(2) }">{{ text.final.total }}</span>
      <span class="tabular-nums" :style="{ fontSize: u(46), fontWeight: 900, lineHeight: 1.05 }" data-testid="final-total" :data-total="result.total">
        <CountUp :value="result.total" :locale="locale" />
      </span>
      <span :style="{ fontSize: u(14), fontWeight: 700, color: '#c9cfd8' }" data-testid="ending-line">
        {{ result.ending === "overtime" ? fmt(text.final.short, { seconds: formatDecimal(result.secondsShort ?? 0, locale) }) : fmt(text.final.clock, { time: clock }) }}
        · {{ fmt(text.final.multiplier, { value: multiplier.toFixed(1) }) }}
      </span>
      <span
        v-if="outcome"
        data-testid="record-note"
        :data-new-record="outcome.isNewRecord"
        :style="{ ...pill(outcome.isNewRecord ? '#ffc83d' : '#1b2030', outcome.isNewRecord ? '#14171f' : '#c9cfd8'), marginTop: u(4), whiteSpace: 'normal' }"
      >
        {{ recordText(outcome) }}
      </span>
    </div>
    <!-- 上榜詢問出現時先收起各項得分，按鈕才不會被擠出遊戲框 -->
    <dl v-if="!askConsent" :aria-label="text.final.partsLabel" class="grid grid-cols-2" :style="{ borderRadius: u(16), background: '#1b2030', padding: `${u(6)} ${u(14)}`, columnGap: u(16) }">
      <div
        v-for="(part, index) in parts"
        :key="part.key"
        class="flex items-baseline justify-between tabular-nums"
        :style="{ padding: `${u(4)} 0`, borderTop: index > 1 ? '1px solid #2a3040' : undefined, fontSize: u(13), fontWeight: 700, gap: u(6) }"
      >
        <dt class="min-w-0 break-words" :style="{ color: '#c9cfd8' }">{{ part.label }}</dt>
        <dd :data-testid="`part-${part.key}`" class="shrink-0">{{ formatNumber(part.value, locale) }}</dd>
      </div>
    </dl>
    <p v-if="!askConsent && newLines > 0" data-testid="new-lines" class="text-center" :style="{ fontSize: u(13), color: '#ffc83d', fontWeight: 700 }">
      {{ fmt(text.final.seen, { count: newLines }) }}
    </p>
    <div
      v-if="askConsent"
      role="group"
      aria-labelledby="consent-title"
      data-testid="consent-prompt"
      class="flex flex-col text-ink"
      :style="{ borderRadius: u(16), border: `${u(2)} solid #ffc83d`, background: '#fff9e6', padding: `${u(10)} ${u(12)}`, gap: u(6) }"
    >
      <p id="consent-title" :style="{ fontSize: u(16), fontWeight: 900 }">{{ base.final.consentTitle }}</p>
      <p :style="{ fontSize: u(13), lineHeight: 1.5, color: '#4a5263' }">
        {{ base.final.consentBody }}
        <a href="/privacy" target="_blank" rel="noopener" class="font-bold text-sign underline underline-offset-2">{{ base.final.consentPrivacy }}</a>
      </p>
      <div class="flex" :style="{ gap: u(8) }">
        <button type="button" data-testid="consent-yes" class="flex-1 cursor-pointer font-black text-white" :style="{ minHeight: u(44), borderRadius: u(999), background: '#1d3a8f', fontSize: u(16) }" @click="joinLeaderboard">
          {{ base.final.consentYes }}
        </button>
        <button type="button" data-testid="consent-no" class="flex-1 cursor-pointer font-black" :style="{ minHeight: u(44), borderRadius: u(999), border: '1px solid #d5dbe3', background: '#ffffff', fontSize: u(16) }" @click="declineLeaderboard">
          {{ base.final.consentNo }}
        </button>
      </div>
    </div>
    <p v-if="props.outcome && !props.outcome.saved" class="text-center" :style="{ fontSize: u(12), color: '#aab3c5', lineHeight: 1.4 }" data-testid="not-saved">
      {{ text.final.notSaved }}
    </p>
    <div class="mt-auto flex shrink-0 flex-col" :style="{ gap: u(8) }">
      <button type="button" data-testid="share-button" class="flex cursor-pointer items-center justify-center font-black text-ink" :style="{ minHeight: u(52), borderRadius: u(16), background: '#ffc83d', boxShadow: `0 ${u(4)} 0 #b8860b`, fontSize: u(19), gap: u(8) }" @click="$emit('share')">
        <Icon name="share" :size="20" />
        {{ text.final.share }}
      </button>
      <div class="flex" :style="{ gap: u(10) }">
        <button type="button" data-testid="again-button" class="flex-1 cursor-pointer font-black text-white" :style="button('#cc4409', '#a83606')" @click="$emit('again')">
          {{ text.final.again }}
        </button>
        <button type="button" data-testid="back-to-intro-button" class="flex-1 cursor-pointer font-black text-white" :style="{ minHeight: u(48), borderRadius: u(16), border: `${u(2)} solid #c9cfd8`, fontSize: u(17) }" @click="$emit('back')">
          {{ text.final.back }}
        </button>
      </div>
    </div>
  </div>
</template>
