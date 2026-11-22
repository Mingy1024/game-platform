<script setup lang="ts">
import type { SceneHandle } from "~/games/office-escape/scene";
import { GAME, type GameContext, type GameText } from "~/games/office-escape/shared";
import { OfficeSound } from "~/games/office-escape/sound";
import type { Popup } from "./EscapeHud.vue";
import { recordRun } from "@/lib/games/office-escape/records-store";
import type { SaveOutcome } from "@/lib/games/office-escape/records";
import { randomSeed, taiwanDateKey } from "@/lib/games/office-escape/route";
import { recordSeen } from "@/lib/games/office-escape/seen";
import { GameSession, type Snapshot } from "@/lib/games/office-escape/session";
import { endingSound, soundFor } from "@/lib/games/office-escape/sound-mix";
import type { SimEvent } from "@/lib/games/office-escape/sim";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fmt, formatDecimal, formatNumber } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/locales";
import { musicOffPref, mutedPref, readMusicOff, readMuted } from "@/lib/sound-pref";

/**
 * 遊戲主畫面。按下出發後整頁換成這個畫面（網址不變）：
 * 上方是返回與控制列，中間是遊戲（three.js 場景＋HTML 介面疊在上面），電腦版左右是操作說明。
 * 只在瀏覽器端建立（介紹頁按出發才下載這個元件、three.js 和音效）。
 */
const props = defineProps<{ locale: Locale; text: GameText; dict: Dictionary }>();
const emit = defineEmits<{ exit: [] }>();

const HISTORY_FLAG = "officeEscapeGame";
/** 往左右滑動至少這麼多像素才算換線（E1）；往上滑同樣門檻才算跳 */
const SWIPE_PX = 30;
const base = props.dict.preciseStop;

const session = shallowRef(new GameSession(randomSeed()));
const snapshot = shallowRef<Snapshot>(session.value.getSnapshot());
watch(
  session,
  (current, _, onCleanup) => {
    snapshot.value = current.getSnapshot();
    onCleanup(current.subscribe(() => (snapshot.value = current.getSnapshot())));
  },
  { immediate: true },
);
const game = computed<GameContext>(() => ({ session: session.value, snapshot, text: props.text, locale: props.locale }));
provide(GAME, game);

const phase = computed(() => snapshot.value.phase);
const paused = computed(() => snapshot.value.paused);
const hasEvent = computed(() => snapshot.value.event !== null);
const total = computed(() => snapshot.value.score);

const status = ref<"loading" | "ready" | "error">("loading");
const attempt = ref(0);
const outcome = shallowRef<SaveOutcome | null>(null);
const newLines = ref(0);
const sharing = ref(false);
const fullscreen = ref(false);
const popups = ref<Popup[]>([]);
const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
// 減少動態效果：突發事件不放慢（session 只改世界速度，限時照算）
watch([session, reduced], ([current, value]) => (current.reduceMotion = value), { immediate: true });
const canFullscreen = typeof document.documentElement.requestFullscreen === "function";

const stageEl = useTemplateRef<HTMLDivElement>("stage");
const canvasEl = useTemplateRef<HTMLDivElement>("canvas");
let scene: SceneHandle | null = null;
let popupCounter = 0;
const popupTimers = new Set<number>();

function popup(message: string, tone: Popup["tone"] = "info") {
  const id = ++popupCounter;
  popups.value = [...popups.value.slice(-2), { id, text: message, tone }];
  const timer = window.setTimeout(() => {
    popups.value = popups.value.filter((item) => item.id !== id);
    popupTimers.delete(timer);
  }, 900);
  popupTimers.add(timer);
}

// ---- 音效：遊戲畫面掛上（按了出發）才建立並載入音檔，離開時關掉 ----
const sound = new OfficeSound(readMuted(), !readMusicOff());
void sound.load();
if (import.meta.dev) (window as unknown as Record<string, unknown>).__officeEscapeSound = sound;
const muted = usePref(mutedPref);
const musicOff = usePref(musicOffPref);
watch(muted, (value) => sound.setMuted(value));
watch(musicOff, (value) => sound.setMusicOn(!value));
let chimed = false;
watch(
  session,
  (current, _, onCleanup) => {
    const sync = () => {
      const state = current.getSnapshot();
      sound.setActive(!state.paused && !document.hidden);
      sound.update(state.phase === "running" && !state.stun && !state.event, state.speed);
      // 最後 10 秒：點名廣播的叮咚聲
      if (!chimed && state.phase === "running" && state.tick >= 80 * 120) {
        chimed = true;
        sound.play("chime.mp3");
      }
    };
    sync();
    onCleanup(current.subscribe(sync));
  },
  { immediate: true },
);
const click = () => sound.play("ui-click.mp3");

// ---- 進出遊戲畫面：隱藏網站其他部分、接管返回鍵（和精準停車相同） ----
const pageRoute = useRoute();
const router = useRouter();
const leaving = ref(false);
let closed = false;
function close() {
  if (closed) return;
  closed = true;
  leaving.value = true;
  emit("exit");
}
const onPopState = () => close();
const hasGameEntry = () => Boolean((window.history.state as Record<string, unknown> | null)?.[HISTORY_FLAG]);
let historyEntry: Promise<unknown> = Promise.resolve();
onMounted(() => {
  document.documentElement.dataset.playing = "1";
  if (!hasGameEntry()) {
    historyEntry = router
      .push({ path: pageRoute.path, query: pageRoute.query, hash: pageRoute.hash, state: { [HISTORY_FLAG]: true }, force: true })
      .catch(() => undefined);
  }
  window.addEventListener("popstate", onPopState);
});
onBeforeUnmount(() => {
  closed = true;
  window.removeEventListener("popstate", onPopState);
  delete document.documentElement.dataset.playing;
  for (const timer of popupTimers) window.clearTimeout(timer);
  sound.dispose();
});

async function exit() {
  if (leaving.value || closed) return;
  leaving.value = true;
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  await historyEntry;
  if (closed) return;
  if (hasGameEntry()) window.history.back();
  else close();
}

// ---- 建立 three.js 場景（這時才載入 three）；按「重試」或換新的一局時重新建立 ----
onMounted(() =>
  watch(
    [session, attempt, reduced],
    ([current], _, onCleanup) => {
      const parent = canvasEl.value;
      if (!parent) return;
      let cancelled = false;
      let handle: SceneHandle | null = null;
      let failed = false;
      status.value = "loading";
      import("~/games/office-escape/scene")
        .then(({ createScene }) => {
          if (cancelled) return;
          handle = createScene({
            parent,
            session: current,
            reducedMotion: reduced.value,
            onReady: () => {
              if (!cancelled && !failed) status.value = "ready";
            },
            onError: () => {
              failed = true;
              if (!cancelled) status.value = "error";
            },
          });
          scene = handle;
          if (import.meta.dev) (window as unknown as Record<string, unknown>).__officeEscape = { session: current, scene: handle };
        })
        .catch((error) => {
          console.error(error);
          if (!cancelled) status.value = "error";
        });
      const observer = new ResizeObserver(() => handle?.refresh());
      observer.observe(parent);
      onCleanup(() => {
        cancelled = true;
        observer.disconnect();
        handle?.destroy();
        if (scene === handle) scene = null;
      });
    },
    { immediate: true, flush: "post" },
  ),
);

// ---- 模擬事件：聲音、提示字、場景反應、結算 ----
watch(
  session,
  (current, _, onCleanup) => {
    onCleanup(
      current.onEvent((event) => {
        scene?.onSimEvent(event as never);
        const t = props.text.hud;
        if (event.type === "depart") sound.play("ui-click.mp3");
        else if (event.type === "graze") {
          sound.graze(event.streak);
          popup(t.graze, "good");
        } else if (event.type === "hit") {
          sound.play("bump.mp3");
          sound.play("delay-tick.mp3", 0.12);
          popup(event.kind === "held" ? t.held : t.trip, "bad");
        } else if (event.type === "door") {
          sound.play(event.passed ? "reader.mp3" : "bump.mp3");
          if (!event.passed) sound.play("delay-tick.mp3", 0.12);
          popup(event.passed ? t.boarded : t.door, event.passed ? "good" : "bad");
        } else if (event.type === "gaze") {
          sound.play("event.mp3");
          popup(t.gaze, "bad");
        } else if (event.type === "pickup") {
          sound.play(soundFor(event)!);
          popup(event.item === "coffee" ? t.pickupCoffee : event.item === "headphones" ? t.pickupHeadphones : t.pickupDnd, "good");
        } else if (event.type === "blocked") popup(event.by === "dnd" ? t.blockedDnd : t.blockedHeadphones, "good");
        else if (event.type === "reader") {
          sound.play("reader.mp3");
          popup(t.reader, "info");
        } else if (event.type === "answer") {
          sound.play(soundFor(event as SimEvent)!);
          const e = props.text.event;
          popup(event.grade === 0 ? fmt(e.best, { points: event.points }) : event.grade === 1 ? fmt(e.normal, { points: event.points }) : e.wrong, event.grade === 2 ? "bad" : "good");
        } else if (event.type === "segment" && event.index < 3) {
          sound.play("ui-click.mp3");
        } else if (event.type === "finish") {
          sound.play("door-spin.mp3");
        } else {
          const name = soundFor(event as SimEvent);
          if (name) sound.play(name);
        }
        if (event.type === "restart") popups.value = [];
        if (event.type === "final") {
          const result = event.result;
          sound.play(endingSound(result.ending, result.hidden));
          outcome.value = recordRun({ dateKey: taiwanDateKey(), total: result.total });
          newLines.value = recordSeen(current.sim.seen);
          sound.finale(outcome.value.isNewRecord, reduced.value);
        }
      }),
    );
  },
  { immediate: true },
);

// ---- 操作 ----
function restart() {
  outcome.value = null;
  sharing.value = false;
  popups.value = [];
  chimed = false;
  sound.cancelScheduled();
  session.value.restart();
}
/** 再玩一次：換一個新的種子（台詞與道具位置重新抽） */
function again() {
  outcome.value = null;
  sharing.value = false;
  popups.value = [];
  chimed = false;
  sound.cancelScheduled();
  session.value = new GameSession(randomSeed());
}

function toggleFullscreen() {
  const element = stageEl.value;
  if (!element || !element.requestFullscreen) return;
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  else void element.requestFullscreen().catch(() => {});
}

const LEFT = new Set(["ArrowLeft", "a", "A"]);
const RIGHT = new Set(["ArrowRight", "d", "D"]);
const JUMP = new Set(["ArrowUp", "w", "W", " ", "Spacebar"]);
function onKeyDown(event: KeyboardEvent) {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const target = event.target as HTMLElement | null;
  const onButton = target?.closest("button, a, input, textarea, select") != null;
  const current = session.value;
  const state = current.getSnapshot();
  if (sharing.value) return;
  const gameKey = LEFT.has(event.key) || RIGHT.has(event.key) || JUMP.has(event.key) || ["ArrowDown", "Enter"].includes(event.key);
  // 空白鍵和方向鍵不捲動頁面
  if (gameKey && event.key !== "Enter") event.preventDefault();
  if (event.repeat) return;
  if (state.event && ["1", "2", "3"].includes(event.key)) {
    current.answer(Number(event.key) - 1);
    return;
  }
  if (state.phase === "briefing" && !state.paused && (event.key === "Enter" || event.key === " ")) {
    if (!onButton) {
      event.preventDefault();
      current.depart();
    }
    return;
  }
  if (state.phase === "running" && !state.paused) {
    if (LEFT.has(event.key)) current.moveLane(-1);
    else if (RIGHT.has(event.key)) current.moveLane(1);
    else if (JUMP.has(event.key)) current.jump();
  }
  switch (event.key) {
    case "p":
    case "P":
      current.togglePause();
      break;
    case "Escape":
      // 全螢幕時 Esc 先由瀏覽器用來離開全螢幕
      if (!document.fullscreenElement) current.togglePause();
      break;
    case "r":
    case "R":
      restart();
      break;
    case "f":
    case "F":
      toggleFullscreen();
      break;
    default:
      break;
  }
}
function onVisibility() {
  if (document.hidden) session.value.pause();
  sound.setActive(!document.hidden && !session.value.getSnapshot().paused);
}
function onFullscreenChange() {
  fullscreen.value = document.fullscreenElement !== null;
  scene?.refresh();
}
onMounted(() => {
  window.addEventListener("keydown", onKeyDown);
  document.addEventListener("visibilitychange", onVisibility);
  document.addEventListener("fullscreenchange", onFullscreenChange);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeyDown);
  document.removeEventListener("visibilitychange", onVisibility);
  document.removeEventListener("fullscreenchange", onFullscreenChange);
});

// ---- 觸控：左右滑換線、往上滑跳。只追蹤第一根手指，多指不會連跳（E1、E6） ----
let tracked: { id: number; x: number; y: number } | null = null;
function onPointerDown(event: PointerEvent) {
  if (event.button !== 0 && event.pointerType === "mouse") return;
  sound.unlock();
  if ((event.target as HTMLElement).closest("[data-no-brake]")) return;
  const state = session.value.getSnapshot();
  if (state.phase !== "running" || state.paused || tracked) return;
  tracked = { id: event.pointerId, x: event.clientX, y: event.clientY };
  try {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  } catch {
    // 某些瀏覽器在指標已結束時會丟錯誤，忽略即可
  }
}
function onPointerMove(event: PointerEvent) {
  if (!tracked || tracked.id !== event.pointerId) return;
  const dx = event.clientX - tracked.x;
  const dy = event.clientY - tracked.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
  if (Math.abs(dx) > Math.abs(dy)) session.value.moveLane(dx > 0 ? 1 : -1);
  else if (dy < 0) session.value.jump();
  // 從這裡重新算起：同一次連續滑動可以再換一條線
  tracked = { id: event.pointerId, x: event.clientX, y: event.clientY };
}
function onPointerEnd(event: PointerEvent) {
  if (tracked?.id === event.pointerId) tracked = null;
}
watch([phase, paused], ([currentPhase, isPaused]) => {
  if (currentPhase !== "running" || isPaused) tracked = null;
});

const controls = computed(() => [
  [props.text.stage.moveKey, props.text.stage.moveKeyValue],
  [props.text.stage.jumpKey, props.text.stage.jumpKeyValue],
  [props.text.stage.answerKey, props.text.stage.answerKeyValue],
  [props.text.stage.nextKey, "Enter"],
  [props.text.stage.pauseKey, "P／Esc"],
  [base.stage.restart, "R"],
  [base.stage.fullscreen, "F"],
]);
const pointsText = computed(() => fmt(props.text.stage.points, { score: formatNumber(total.value, props.locale) }));
const barButton =
  "flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 text-sm font-bold hover:bg-white/20";
void formatDecimal;
</script>

<template>
  <!-- 掛到 body 底下，蓋住整個網站（頁首、說明、廣告都由 CSS 隱藏） -->
  <Teleport to="body">
    <div
      ref="stage"
      data-game-stage
      data-testid="game-stage"
      :data-phase="phase"
      :data-reduced-motion="reduced"
      class="on-dark fixed inset-0 z-50 flex flex-col overflow-hidden bg-canvas text-white"
    >
      <div class="flex h-14 shrink-0 items-center gap-2 border-b border-[#222838] bg-[#0b0e14] px-2 md:px-5">
        <button type="button" :class="barButton" :aria-label="base.stage.back" data-testid="back-button" :disabled="leaving" @click="exit">
          <Icon name="left" :size="18" />
          <span class="hidden md:inline">{{ base.stage.back }}</span>
        </button>
        <p class="line-clamp-2 min-w-0 flex-1 text-center text-sm font-extrabold leading-tight md:text-left md:text-lg">{{ text.title }}</p>
        <button type="button" :class="`${barButton} hidden md:flex`" :disabled="phase === 'final'" @click="session.togglePause()">
          <Icon name="pause" :size="18" />
          {{ base.stage.pause }}
          <kbd class="rounded bg-white/15 px-1.5 text-xs">P</kbd>
        </button>
        <button type="button" :class="barButton" :aria-label="base.stage.restart" @click="restart">
          <Icon name="restart" :size="18" />
          <span class="hidden md:inline">{{ base.stage.restart }}</span>
          <kbd class="hidden rounded bg-white/15 px-1.5 text-xs md:inline">R</kbd>
        </button>
        <button v-if="canFullscreen" type="button" :class="barButton" :aria-label="fullscreen ? base.stage.exitFullscreen : base.stage.fullscreen" @click="toggleFullscreen">
          <Icon name="expand" :size="18" />
          <span class="hidden md:inline">{{ fullscreen ? base.stage.exitFullscreen : base.stage.fullscreen }}</span>
          <kbd class="hidden rounded bg-white/15 px-1.5 text-xs md:inline">F</kbd>
        </button>
      </div>

      <div class="ps-layout min-h-0 flex-1">
        <section :aria-label="text.stage.controls" class="ps-side ps-side-left rounded-2xl bg-[#1b2030] p-4 text-sm">
          <h2 class="text-lg font-extrabold">{{ text.stage.controls }}</h2>
          <dl class="mt-2 flex flex-col gap-2">
            <div v-for="[label, value] in controls" :key="label" class="flex justify-between gap-3">
              <dt class="font-bold">{{ label }}</dt>
              <dd class="text-right text-[#c9cfd8]">{{ value }}</dd>
            </div>
          </dl>
        </section>

        <div
          class="ps-frame"
          data-testid="game-frame"
          role="application"
          :aria-label="text.stage.gameLabel"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerEnd"
          @pointercancel="onPointerEnd"
          @lostpointercapture="onPointerEnd"
          @contextmenu.prevent
        >
          <div ref="canvas" class="ps-canvas absolute inset-0" data-testid="scene" />

          <EscapeHud v-if="(phase === 'running' || phase === 'briefing' || phase === 'finishing') && status === 'ready'" :popups="popups" :labels="base.stage" @pause="session.pause()" />
          <EscapeEvent v-if="hasEvent && phase === 'running'" @answer="session.answer($event)" />
          <EscapeBriefing v-if="phase === 'briefing' && status === 'ready' && !paused" @depart="session.depart()" />
          <EscapeFinal
            v-if="phase === 'final'"
            :outcome="outcome"
            :new-lines="newLines"
            :base="base"
            @share="
              sharing = true;
              click();
            "
            @again="
              again();
              click();
            "
            @back="
              click();
              exit();
            "
          />
          <EscapePause
            v-if="paused && status === 'ready'"
            :base="base.pause"
            @resume="
              session.resume();
              click();
            "
            @restart="
              restart();
              click();
            "
            @back="
              click();
              exit();
            "
          />

          <div v-if="status === 'loading'" class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-canvas" data-no-brake role="status">
            <span class="ps-spinner size-10 rounded-full border-4 border-white/20 border-t-edge" />
            <p class="font-bold text-[#c9cfd8]">{{ text.stage.loading }}</p>
          </div>
          <div v-if="status === 'error'" class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-canvas p-6 text-center" data-no-brake role="alert" data-testid="game-error">
            <p class="text-xl font-extrabold">{{ base.stage.errorTitle }}</p>
            <p class="text-[#c9cfd8]">{{ text.stage.noWebgl }} {{ base.stage.errorBody }}</p>
            <button type="button" class="press mt-2 min-h-12 cursor-pointer rounded-full bg-express px-8 text-lg font-bold text-white" @click="attempt++">
              {{ base.stage.retry }}
            </button>
          </div>
        </div>

        <section :aria-label="text.stage.controls" class="ps-side ps-side-right rounded-2xl bg-sign-deep p-4 text-sm">
          <h2 class="text-lg font-extrabold">{{ text.stage.route }}</h2>
          <ol class="mt-2 flex flex-col gap-2">
            <li v-for="(segment, index) in text.segments" :key="segment.name" :class="`flex flex-col rounded-xl px-3 py-2 ${index === snapshot.segment && phase !== 'final' ? 'bg-sign' : 'bg-white/5'}`">
              <span class="font-extrabold">{{ index + 1 }}{{ "\u3000" }}{{ segment.name }}</span>
              <span class="text-[#c9cfd8]">{{ segment.hint }}</span>
            </li>
          </ol>
          <p class="mt-3 border-t border-white/10 pt-3 font-extrabold tabular-nums text-edge" data-testid="running-total">{{ pointsText }}</p>
        </section>

        <section :aria-label="text.stage.route" class="ps-below flex-col gap-2 px-4 pb-4 pt-3">
          <p class="text-center text-xs leading-relaxed text-[#aab3c5]">{{ text.stage.touchHint }}</p>
        </section>
      </div>

      <EscapeShare
        v-if="sharing && outcome && snapshot.result"
        :text="text"
        :base="base"
        :locale="locale"
        :result="snapshot.result"
        :new-record="outcome.isNewRecord"
        :date-key="taiwanDateKey()"
        @close="sharing = false"
      />
    </div>
  </Teleport>
</template>
