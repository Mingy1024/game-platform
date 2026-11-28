<script setup lang="ts">
import { seconds, u, useGame } from "~/games/monk-soup-tower/shared";
import { readConsent, subscribeConsent } from "@/lib/account/leaderboard-consent";
import { FLAGS } from "@/lib/flags";
import { declineLeaderboard, joinLeaderboard } from "@/lib/games/monk-soup-tower/account-sync";
import { ENDING, shareable } from "@/lib/games/monk-soup-tower/config";
import type { SaveOutcome } from "@/lib/games/monk-soup-tower/records";
import { seedLabel } from "@/lib/games/monk-soup-tower/tower";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fmt, formatNumber } from "@/lib/i18n/format";

/**
 * 結算（F8、F9）。
 * - 送達塔頂：模式（隨機模式加塔號）、評級、得分（跑動 1.2 秒）、湯量、溫度與分段、時間、新紀錄；分享、再爬一次、回介紹頁
 * - 踩空、湯灑光：原因、到第幾層、湯量、時間，不顯示分數；再爬一次、回介紹頁
 * 歐盟地區還沒決定的訪客，送達塔頂時多一張「要不要上全站排行」（T10）。
 */
const props = defineProps<{ outcome: SaveOutcome | null; base: Dictionary["preciseStop"] }>();
defineEmits<{ share: []; again: []; back: [] }>();
const game = useGame();
const text = computed(() => game.value.text);
const locale = computed(() => game.value.locale);
const result = computed(() => game.value.snapshot.value.result!);
const success = computed(() => result.value.outcome === "summit");
/** 超過 30 分鐘的一局成績代碼放不下：照常結算，只是不能分享 */
const canShare = computed(() => success.value && shareable(result.value.timeMs));

const me = useMe();
const consent = useExternalStore(subscribeConsent, readConsent, null);
const askConsent = computed(
  () => success.value && FLAGS.login && FLAGS.leaderboard && me.value.status === "loggedOut" && !me.value.guest && me.value.consentRequired && consent.value === null,
);

const modeLabel = computed(() => {
  const r = result.value;
  const mode = text.value.modes[r.mode];
  return r.mode === "random" && r.seed !== null ? `${mode} · ${fmt(text.value.final.seed, { seed: seedLabel(r.seed) })}` : mode;
});

/** 紀錄說明：破了最佳分數就顯示新紀錄（第一筆、或舊 → 新），沒破顯示目前最佳 */
const note = computed(() => {
  const o = props.outcome;
  const r = result.value;
  if (!o || !success.value || r.score === null) return null;
  const t = text.value.final;
  const previous = o.previous[r.mode];
  if (o.newBest) {
    return { record: true, text: `${t.newRecord} ${previous === null ? t.firstRecord : fmt(t.recordChange, { from: formatNumber(previous.score, locale.value), to: formatNumber(r.score, locale.value) })}` };
  }
  return { record: false, text: fmt(t.best, { score: formatNumber(o.records[r.mode]?.score ?? 0, locale.value) }) };
});

const stats = computed(() => {
  const r = result.value;
  const t = text.value.final;
  const list = [
    { key: "soup", label: t.soup, value: `${formatNumber(Math.round(r.soup / 10), locale.value)}%`, extra: "" },
    { key: "temp", label: t.temp, value: `${formatNumber(Math.floor(r.temp), locale.value)}℃`, extra: text.value.bands[r.band] },
    { key: "time", label: t.time, value: fmt(t.seconds, { time: seconds(r.timeMs, locale.value) }), extra: "" },
  ];
  return success.value ? list : list.filter((item) => item.key !== "temp");
});
/** 評級在分數跑完（1.2 秒）之後才出現；減少動態效果時直接顯示（G4，Codex 審查第 2 輪） */
const gradeShown = ref(typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
let gradeTimer = 0;
onMounted(() => {
  if (!gradeShown.value) gradeTimer = window.setTimeout(() => (gradeShown.value = true), ENDING.countUpMs);
});
onBeforeUnmount(() => window.clearTimeout(gradeTimer));
const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
watch(reducedMotion, (value) => {
  if (value) gradeShown.value = true;
});
const gradeColor = { S: "#a8372c", A: "#c7802a", B: "#3d6fa8", C: "#5b6b67" } as const;
const primary = { minHeight: `max(44px, ${u(52)})`, borderRadius: u(16), background: "#a8372c", color: "#fff", boxShadow: `0 ${u(4)} 0 #6f211a`, fontSize: u(17), fontWeight: 900 };
const secondary = { minHeight: `max(44px, ${u(52)})`, borderRadius: u(16), background: "#e4ece8", color: "#23302d", fontSize: u(17), fontWeight: 900 };
</script>

<template>
  <div data-ui data-testid="final-panel" :data-outcome="result.outcome" class="absolute inset-0 flex flex-col justify-end overflow-y-auto" :style="{ background: 'rgba(35,48,45,0.45)', padding: u(16) }">
    <div class="flex flex-col" :style="{ borderRadius: u(24), background: '#f4f7f5', color: '#23302d', padding: `${u(20)} ${u(20)}`, gap: u(12), boxShadow: '0 18px 50px rgba(0,0,0,.3)' }">
      <div class="flex items-center justify-between" :style="{ gap: u(8) }">
        <span data-testid="final-mode" class="min-w-0 truncate" :style="{ padding: `${u(4)} ${u(12)}`, borderRadius: '999px', background: '#e4ece8', fontSize: u(13), fontWeight: 900 }">{{ modeLabel }}</span>
        <div class="flex shrink-0" :style="{ gap: u(6) }"><MonkSoundButtons :labels="base.stage" light /></div>
      </div>

      <template v-if="success && result.score !== null && result.grade">
        <div class="flex items-center" :style="{ gap: u(14) }">
          <span
            data-testid="final-grade"
            class="flex shrink-0 items-center justify-center"
            :data-shown="gradeShown"
            :style="{ width: u(84), height: u(84), borderRadius: u(22), background: gradeShown ? gradeColor[result.grade] : '#e4ece8', color: '#fff', fontSize: u(54), fontWeight: 900, lineHeight: 1, transition: 'background 0.2s' }"
            >{{ gradeShown ? result.grade : "" }}</span
          >
          <div class="flex min-w-0 flex-col">
            <h2 :style="{ fontSize: u(22), fontWeight: 900, lineHeight: 1.25 }">{{ text.final.summit }}</h2>
            <p :style="{ fontSize: u(14), color: '#5b6b67', fontWeight: 700 }">
              {{ text.final.score }}
              <b class="tabular-nums" data-testid="final-score" :data-score="result.score" :style="{ fontSize: u(34), color: '#23302d', fontWeight: 900 }"><CountUp :value="result.score" :locale="locale" /></b>
            </p>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="flex flex-col" :style="{ gap: u(2) }">
          <h2 data-testid="final-reason" :style="{ fontSize: u(26), fontWeight: 900 }">{{ result.outcome === "fall" ? text.final.reasonFall : text.final.reasonEmpty }}</h2>
          <p data-testid="final-floor" :data-floor="result.floor" :style="{ fontSize: u(17), fontWeight: 700, color: '#33413e' }">{{ fmt(text.final.reached, { floor: result.floor }) }}</p>
        </div>
      </template>

      <dl class="grid" :style="{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))`, gap: u(8) }">
        <div v-for="item in stats" :key="item.key" class="flex min-w-0 flex-col" :style="{ background: '#e4ece8', borderRadius: u(12), padding: `${u(8)} ${u(10)}` }">
          <dt :style="{ fontSize: u(12), color: '#5b6b67', fontWeight: 700 }">{{ item.label }}</dt>
          <dd :data-testid="`final-${item.key}`" class="whitespace-nowrap tabular-nums" :style="{ fontSize: u(item.value.length > 7 ? 16 : 19), fontWeight: 900 }">{{ item.value }}</dd>
          <dd v-if="item.extra" data-testid="final-band" :style="{ fontSize: u(12), fontWeight: 700, color: '#a8372c' }">{{ item.extra }}</dd>
        </div>
      </dl>

      <p v-if="note" data-testid="record-note" :data-new-record="note.record" class="self-start" :style="{ padding: `${u(4)} ${u(12)}`, borderRadius: '999px', background: note.record ? '#e0a43a' : '#e4ece8', color: '#23302d', fontSize: u(13), fontWeight: 900 }">
        {{ note.text }}
      </p>

      <div v-if="askConsent" role="group" aria-labelledby="consent-title" data-testid="consent-prompt" class="flex flex-col" :style="{ borderRadius: u(14), border: `${u(2)} solid #e0a43a`, background: '#fbefc4', padding: `${u(10)} ${u(12)}`, gap: u(6) }">
        <p id="consent-title" :style="{ fontSize: u(15), fontWeight: 900 }">{{ base.final.consentTitle }}</p>
        <p :style="{ fontSize: u(13), lineHeight: 1.5 }">
          {{ base.final.consentBody }}
          <a href="/privacy" target="_blank" rel="noopener" class="font-bold underline underline-offset-2">{{ base.final.consentPrivacy }}</a>
        </p>
        <div class="flex" :style="{ gap: u(8) }">
          <button type="button" data-testid="consent-yes" class="flex-1 cursor-pointer" :style="{ ...primary, minHeight: `max(44px, ${u(44)})`, fontSize: u(15) }" @click="joinLeaderboard">{{ base.final.consentYes }}</button>
          <button type="button" data-testid="consent-no" class="flex-1 cursor-pointer" :style="{ ...secondary, minHeight: `max(44px, ${u(44)})`, fontSize: u(15) }" @click="declineLeaderboard">{{ base.final.consentNo }}</button>
        </div>
      </div>

      <p v-if="outcome && !outcome.saved" data-testid="not-saved" :style="{ fontSize: u(12), color: '#5b6b67', lineHeight: 1.4 }">{{ text.final.notSaved }}</p>

      <div class="flex flex-col" :style="{ gap: u(10) }">
        <button v-if="canShare" type="button" data-testid="share-button" class="flex cursor-pointer items-center justify-center" :style="{ ...primary, gap: u(8) }" @click="$emit('share')">
          <Icon name="share" :size="20" />
          {{ text.final.share }}
        </button>
        <div class="flex" :style="{ gap: u(10) }">
          <button type="button" data-testid="again-button" class="flex-1 cursor-pointer" :style="success ? secondary : primary" @click="$emit('again')">{{ text.final.again }}</button>
          <button type="button" data-testid="back-to-intro-button" class="flex-1 cursor-pointer" :style="secondary" @click="$emit('back')">{{ text.final.back }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
