<script setup lang="ts">
import { u, useGame } from "~/games/mine-descent/shared";
import { readConsent, subscribeConsent } from "@/lib/account/leaderboard-consent";
import { FLAGS } from "@/lib/flags";
import { declineLeaderboard, joinLeaderboard } from "@/lib/games/mine-descent/account-sync";
import type { SaveOutcome } from "@/lib/games/mine-descent/records";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fmt, formatNumber } from "@/lib/i18n/format";

/** 結算（F 組）：下降的公尺數、總分、各項得分、紀錄、上榜詢問（歐盟）、分享與再玩一次 */
const props = defineProps<{ outcome: SaveOutcome | null; base: Dictionary["preciseStop"] }>();
defineEmits<{ share: []; again: []; back: [] }>();
const game = useGame();
const text = computed(() => game.value.text);
const locale = computed(() => game.value.locale);
const result = computed(() => game.value.snapshot.value.result);
const parts = computed(() => (["depth", "graze", "crystal"] as const).map((key) => ({ key, label: text.value.final.parts[key], value: result.value?.parts[key] ?? 0 })));

const me = useMe();
const consent = useExternalStore(subscribeConsent, readConsent, null);
const askConsent = computed(
  () => FLAGS.login && FLAGS.leaderboard && me.value.status === "loggedOut" && !me.value.guest && me.value.consentRequired && consent.value === null,
);

/** 這一局的紀錄說明：最深紀錄、最高分紀錄，都沒破就顯示目前的最佳 */
const notes = computed(() => {
  const t = text.value.final;
  const o = props.outcome;
  if (!o || !result.value) return [];
  const list: { key: string; text: string; record: boolean }[] = [];
  if (o.newDepth) list.push({ key: "depth", record: true, text: `${t.newDepth} ${o.previous.depth === null ? t.firstRecord : fmt(t.recordChange, { from: formatNumber(o.previous.depth, locale.value), to: formatNumber(result.value.depth, locale.value) })}` });
  if (o.newScore) list.push({ key: "score", record: true, text: `${t.newScore} ${o.previous.score === null ? t.firstRecord : fmt(t.recordChange, { from: formatNumber(o.previous.score, locale.value), to: formatNumber(result.value.total, locale.value) })}` });
  if (list.length === 0) list.push({ key: "best", record: false, text: fmt(t.best, { depth: formatNumber(o.records.depth ?? 0, locale.value), score: formatNumber(o.records.score ?? 0, locale.value) }) });
  return list;
});
const pill = (background: string, color = "#fff") => ({
  padding: `${u(4)} ${u(12)}`,
  borderRadius: "999px",
  background,
  color,
  fontSize: u(14),
  fontWeight: 900,
});
const comic = (background: string) => ({
  minHeight: u(44),
  borderRadius: u(14),
  background,
  border: `${u(4)} solid #1a120c`,
  boxShadow: `${u(4)} ${u(4)} 0 #1a120c`,
  color: "#1a120c",
});
</script>

<template>
  <div v-if="result" data-testid="final-panel" :data-reason="result.reason" data-no-brake class="absolute inset-0 flex flex-col overflow-y-auto" :style="{ background: 'rgba(26,18,12,0.9)', padding: `${u(10)} ${u(20)}`, gap: u(6) }">
    <div class="flex items-center justify-between" :style="{ gap: u(8) }">
      <span :style="pill('#e8452c')">{{ text.title }}</span>
      <div class="flex shrink-0" :style="{ gap: u(6) }"><MineSoundButtons :labels="base.stage" /></div>
    </div>
    <div class="flex flex-col items-center text-center" :style="{ gap: u(1) }">
      <MoleFace pose="dizzy" :size="u(78)" />
      <p :style="{ fontSize: u(14), fontWeight: 900, color: '#fff3d0' }" data-testid="final-reason">{{ result.reason === "hp" ? text.final.reasonHp : text.final.reasonFall }}</p>
      <span :style="{ fontSize: u(13), fontWeight: 700, color: '#e8d4a0' }">{{ text.final.reached }}</span>
      <span class="tabular-nums" :style="{ fontSize: u(46), fontWeight: 900, fontStyle: 'italic', lineHeight: 1.05, color: '#ffd23f', WebkitTextStroke: `${u(2.5)} #1a120c`, paintOrder: 'stroke fill' }" data-testid="final-depth" :data-depth="result.depth">
        <CountUp :value="result.depth" :locale="locale" /><span :style="{ fontSize: u(20) }"> {{ text.hud.unit }}</span>
      </span>
      <span :style="{ fontSize: u(15), fontWeight: 700, color: '#e8d4a0' }">
        {{ text.final.total }}
        <span class="tabular-nums" :style="{ fontSize: u(24), fontWeight: 900, color: '#fff3d0' }" data-testid="final-total" :data-total="result.total"><CountUp :value="result.total" :locale="locale" /></span>
      </span>
      <span
        v-for="note in notes"
        :key="note.key"
        data-testid="record-note"
        :data-new-record="note.record"
        :style="{ ...pill(note.record ? '#ffd23f' : '#3a2618', note.record ? '#1a120c' : '#e8d4a0'), marginTop: u(3), whiteSpace: 'normal', fontSize: u(13) }"
      >
        {{ note.text }}
      </span>
    </div>
    <!-- 上榜詢問出現時先收起各項得分，按鈕才不會被擠出遊戲框 -->
    <dl v-if="!askConsent" :aria-label="text.final.partsLabel" class="grid grid-cols-3" :style="{ borderRadius: u(14), background: '#2a1710', padding: `${u(2)} ${u(10)}`, columnGap: u(10) }">
      <div v-for="part in parts" :key="part.key" class="flex flex-col items-center tabular-nums" :style="{ padding: `${u(4)} 0`, fontWeight: 700, fontSize: u(13) }">
        <dt :style="{ color: '#e8d4a0' }" class="text-center">{{ part.label }}</dt>
        <dd :data-testid="`part-${part.key}`" :style="{ fontSize: u(17), fontWeight: 900 }">{{ formatNumber(part.value, locale) }}</dd>
      </div>
    </dl>
    <div
      v-if="askConsent"
      role="group"
      aria-labelledby="consent-title"
      data-testid="consent-prompt"
      class="flex flex-col"
      :style="{ borderRadius: u(14), border: `${u(3)} solid #ffd23f`, background: '#fff3d0', color: '#1a120c', padding: `${u(10)} ${u(12)}`, gap: u(6) }"
    >
      <p id="consent-title" :style="{ fontSize: u(16), fontWeight: 900 }">{{ base.final.consentTitle }}</p>
      <p :style="{ fontSize: u(13), lineHeight: 1.5 }">
        {{ base.final.consentBody }}
        <a href="/privacy" target="_blank" rel="noopener" class="font-bold underline underline-offset-2">{{ base.final.consentPrivacy }}</a>
      </p>
      <div class="flex" :style="{ gap: u(8) }">
        <button type="button" data-testid="consent-yes" class="flex-1 cursor-pointer font-black" :style="{ ...comic('#ffd23f'), minHeight: u(44), fontSize: u(16) }" @click="joinLeaderboard">{{ base.final.consentYes }}</button>
        <button type="button" data-testid="consent-no" class="flex-1 cursor-pointer font-black" :style="{ ...comic('#ffffff'), minHeight: u(44), fontSize: u(16) }" @click="declineLeaderboard">{{ base.final.consentNo }}</button>
      </div>
    </div>
    <p v-if="props.outcome && !props.outcome.saved" class="text-center" :style="{ fontSize: u(12), color: '#e8d4a0', lineHeight: 1.4 }" data-testid="not-saved">
      {{ text.final.notSaved }}
    </p>
    <div class="mt-auto flex shrink-0 flex-col" :style="{ gap: u(6) }">
      <button type="button" data-testid="share-button" class="flex cursor-pointer items-center justify-center font-black" :style="{ ...comic('#ffd23f'), minHeight: u(44), fontSize: u(17), gap: u(8) }" @click="$emit('share')">
        <Icon name="share" :size="20" />
        {{ text.final.share }}
      </button>
      <div class="flex" :style="{ gap: u(10) }">
        <button type="button" data-testid="again-button" class="flex-1 cursor-pointer font-black" :style="{ ...comic('#e8452c'), color: '#fff3d0', fontSize: u(17) }" @click="$emit('again')">
          {{ text.final.again }}
        </button>
        <button type="button" data-testid="back-to-intro-button" class="flex-1 cursor-pointer font-black" :style="{ ...comic('#fff3d0'), fontSize: u(17) }" @click="$emit('back')">
          {{ text.final.back }}
        </button>
      </div>
    </div>
  </div>
</template>
