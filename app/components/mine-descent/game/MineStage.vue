<script setup lang="ts">
import type { SceneHandle } from "~/games/mine-descent/scene";
import { GAME, type GameContext, type GameText } from "~/games/mine-descent/shared";
import { MineSound } from "~/games/mine-descent/sound";
import type { Popup } from "./MineHud.vue";
import { FIELD, FX } from "@/lib/games/mine-descent/config";
import type { SaveOutcome } from "@/lib/games/mine-descent/records";
import { recordRun } from "@/lib/games/mine-descent/records-store";
import { MineSession, type Snapshot } from "@/lib/games/mine-descent/session";
import type { SimEvent } from "@/lib/games/mine-descent/sim";
import { grazeRate, landGain, soundFor } from "@/lib/games/mine-descent/sound-mix";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fmt, formatNumber } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/locales";
import { mutedPref, readMuted } from "@/lib/sound-pref";

/**
 * 遊戲主畫面。按下出發後整頁換成這個畫面（網址不變）：
 * 上方是返回與控制列，中間是遊戲（Phaser 場景＋HTML 介面疊在上面），電腦版左右是操作說明與深度段落。
 * 只在瀏覽器端建立（介紹頁按出發才下載這個元件、Phaser 和音效）。
 */
const props = defineProps<{ locale: Locale; text: GameText; dict: Dictionary }>();
const emit = defineEmits<{ exit: [] }>();

const HISTORY_FLAG = "mineDescentGame";
/** 開始後前幾秒顯示左右半邊的觸控提示（毫秒） */
const HINT_MS = 3000;
const base = props.dict.preciseStop;

const session = shallowRef(new MineSession());
const snapshot = shallowRef<Snapshot>(session.value.snapshot());
const game = computed<GameContext>(() => ({ session: session.value, snapshot, text: props.text, locale: props.locale }));
provide(GAME, game);

const phase = computed(() => snapshot.value.phase);
const paused = computed(() => snapshot.value.phase === "paused");

const status = ref<"loading" | "ready" | "error">("loading");
const attempt = ref(0);
const outcome = shallowRef<SaveOutcome | null>(null);
const sharing = ref(false);
const fullscreen = ref(false);
const hint = ref(false);
const popups = ref<Popup[]>([]);
const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
const canFullscreen = typeof document.documentElement.requestFullscreen === "function";

const stageEl = useTemplateRef<HTMLDivElement>("stage");
const canvasEl = useTemplateRef<HTMLDivElement>("canvas");
const frameEl = useTemplateRef<HTMLDivElement>("frame");
let scene: SceneHandle | null = null;
let popupCounter = 0;
const timers = new Set<number>();

function later(callback: () => void, ms: number) {
  const timer = window.setTimeout(() => {
    timers.delete(timer);
    callback();
  }, ms);
  timers.add(timer);
}

function popup(message: string, tone: Popup["tone"], x = 50, y = 38) {
  const id = ++popupCounter;
  popups.value = [...popups.value.slice(-3), { id, text: message, tone, x, y }];
  later(() => (popups.value = popups.value.filter((item) => item.id !== id)), 900);
}

// ---- 音效：遊戲畫面掛上（按了出發）才建立並載入音檔，離開時關掉 ----
const sound = new MineSound(readMuted());
void sound.load();
if (import.meta.dev) (window as unknown as Record<string, unknown>).__mineDescentSound = sound;
const muted = usePref(mutedPref);
watch(muted, (value) => sound.setMuted(value));
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
  // 慢動作還沒結束就離開：先還原時間倍率，再清掉所有計時器
  slowmo?.restore();
  for (const timer of timers) window.clearTimeout(timer);
  sound.dispose();
  // 開發用的全域掛勾只留給目前這一局
  if (import.meta.dev) {
    const globals = window as unknown as Record<string, unknown>;
    if ((globals.__mineDescent as { session?: unknown } | undefined)?.session === session.value) delete globals.__mineDescent;
    if (globals.__mineDescentSound === sound) delete globals.__mineDescentSound;
  }
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

// ---- 場景（Phaser）：這時才載入；按「重試」時重新建立。場景是遊戲的時鐘，每一格呼叫 session.update ----
function onEvents(events: SimEvent[]) {
  const t = props.text.hud;
  for (const event of events) {
    if (event.type === "land") sound.play(soundFor(event) ?? "land.mp3", { gain: landGain(event.vy) });
    else if (event.type === "graze") {
      sound.play(soundFor(event)!, { rate: grazeRate(event.mult) });
      popup(`${t.graze} +${event.points}`, "good", (event.x / FIELD.width) * 100, (event.y / FIELD.height) * 100 - 6);
      slowMotion();
    } else if (event.type === "hurt") {
      sound.play("hurt.mp3");
      popup(t.hurt, "bad", (event.x / FIELD.width) * 100, (event.y / FIELD.height) * 100 - 8);
    } else if (event.type === "crystal") {
      sound.play("crystal-pickup.mp3");
      popup(fmt(t.crystal, { points: event.points }), "good", (event.x / FIELD.width) * 100, (event.y / FIELD.height) * 100 - 8);
    } else if (event.type === "bounce") {
      sound.play("wood-bounce.mp3");
      popup(t.bounce, "info", (event.x / FIELD.width) * 100, (event.y / FIELD.height) * 100 - 8);
    } else if (event.type === "heal") popup(t.heal, "good", 22, 84);
    else {
      const name = soundFor(event);
      if (name) sound.play(name);
    }
  }
}

/** 驚險時鏡頭慢動作 0.2 秒（減少動態效果時不做）。只改時間倍率，不影響判定 */
let slowmo: { restore(): void } | null = null;
function slowMotion() {
  if (reduced.value || slowmo !== null) return;
  const current = session.value;
  const normal = current.timeScale;
  current.timeScale = normal * FX.slowmoScale;
  const restore = () => {
    slowmo = null;
    current.timeScale = normal;
  };
  slowmo = { restore };
  later(restore, FX.slowmoSeconds * 1000);
}

let lastPhase: Snapshot["phase"] = "ready";
function onFrame() {
  const current = session.value;
  const next = current.snapshot();
  snapshot.value = next;
  const state = current.sim;
  sound.update(next.phase === "playing", next.headroom, state.player.ground === null ? state.player.vy : 0);
  if (next.phase !== lastPhase) {
    if (next.phase === "over" && next.result) {
      outcome.value = recordRun({ depth: next.result.depth, total: next.result.total });
      sound.finale(outcome.value.newScore || outcome.value.newDepth, reduced.value);
    }
    lastPhase = next.phase;
  }
}

onMounted(() =>
  watch(
    [attempt],
    (_, __, onCleanup) => {
      const parent = canvasEl.value;
      if (!parent) return;
      let cancelled = false;
      let handle: SceneHandle | null = null;
      let failed = false;
      status.value = "loading";
      import("~/games/mine-descent/scene")
        .then(({ createScene }) => {
          if (cancelled) return;
          handle = createScene({
            parent,
            session: session.value,
            reducedMotion: reduced.value,
            onEvents,
            onFrame,
            onReady: () => {
              if (!cancelled && !failed) status.value = "ready";
            },
            onError: () => {
              failed = true;
              if (!cancelled) status.value = "error";
            },
          });
          scene = handle;
          if (import.meta.dev) (window as unknown as Record<string, unknown>).__mineDescent = { session: session.value, scene: handle };
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
watch(reduced, (value) => scene?.setReducedMotion(value));

// ---- 操作 ----
function depart() {
  const current = session.value;
  if (current.phase !== "ready") return;
  current.start();
  sound.play("game-start.mp3");
  showHint();
  snapshot.value = current.snapshot();
}
function showHint() {
  hint.value = true;
  later(() => (hint.value = false), HINT_MS);
}
function restart() {
  outcome.value = null;
  sharing.value = false;
  popups.value = [];
  sound.cancelScheduled();
  session.value.restart();
  keys.left = keys.right = false;
  touch.clear();
  applyAxis();
  showHint();
  snapshot.value = session.value.snapshot();
}
function togglePause() {
  const current = session.value;
  if (current.phase === "playing") current.pause();
  else if (current.phase === "paused") current.resume();
  snapshot.value = current.snapshot();
  sound.setActive(current.phase !== "paused" && !document.hidden);
}
function resume() {
  session.value.resume();
  snapshot.value = session.value.snapshot();
  sound.setActive(!document.hidden);
}

function toggleFullscreen() {
  const element = stageEl.value;
  if (!element || !element.requestFullscreen) return;
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  else void element.requestFullscreen().catch(() => {});
}

// ---- 鍵盤：← → 或 A／D。兩個一起按時以後按的為準 ----
const keys = { left: false, right: false, last: 0 as -1 | 0 | 1 };
const LEFT = new Set(["ArrowLeft", "a", "A"]);
const RIGHT = new Set(["ArrowRight", "d", "D"]);
const touch = new Map<number, -1 | 1>();
let touchLast: -1 | 1 | 0 = 0;

function applyAxis() {
  let axis: -1 | 0 | 1 = 0;
  if (touch.size > 0) axis = touchLast || 0;
  else if (keys.left && keys.right) axis = keys.last;
  else if (keys.left) axis = -1;
  else if (keys.right) axis = 1;
  session.value.setAxis(axis);
}

function onKeyDown(event: KeyboardEvent) {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const target = event.target as HTMLElement | null;
  const onButton = target?.closest("button, a, input, textarea, select") != null;
  if (sharing.value) return;
  const state = session.value.phase;
  const space = event.key === " " || event.key === "Spacebar";
  const gameKey = LEFT.has(event.key) || RIGHT.has(event.key) || space || event.key === "ArrowUp" || event.key === "ArrowDown";
  // 空白鍵和方向鍵不捲動頁面；但焦點在按鈕上時，空白鍵留給按鈕自己（按下去就是點它）
  if (gameKey && !(space && onButton)) event.preventDefault();
  sound.unlock();
  if (LEFT.has(event.key)) {
    // 按住不放的自動重複不算「後按」，不然另一個方向會被蓋回來
    if (!keys.left) keys.last = -1;
    keys.left = true;
    applyAxis();
    return;
  }
  if (RIGHT.has(event.key)) {
    if (!keys.right) keys.last = 1;
    keys.right = true;
    applyAxis();
    return;
  }
  if (event.repeat) return;
  if (state === "ready" && (event.key === "Enter" || space)) {
    // 焦點在按鈕上：空白鍵由按鈕自己的點擊開始；Enter 一律直接開始
    if (!onButton || event.key === "Enter") {
      event.preventDefault();
      depart();
    }
    return;
  }
  switch (event.key) {
    case "p":
    case "P":
      togglePause();
      break;
    case "Escape":
      // 全螢幕時 Esc 先由瀏覽器用來離開全螢幕
      if (!document.fullscreenElement) togglePause();
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
function onKeyUp(event: KeyboardEvent) {
  if (LEFT.has(event.key)) keys.left = false;
  else if (RIGHT.has(event.key)) keys.right = false;
  else return;
  applyAxis();
}
function onVisibility() {
  if (document.hidden) {
    session.value.pause();
    snapshot.value = session.value.snapshot();
    keys.left = keys.right = false;
    touch.clear();
    applyAxis();
  }
  sound.setActive(!document.hidden && session.value.phase !== "paused");
}
function onFullscreenChange() {
  fullscreen.value = document.fullscreenElement !== null;
  scene?.refresh();
}
onMounted(() => {
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  document.addEventListener("visibilitychange", onVisibility);
  document.addEventListener("fullscreenchange", onFullscreenChange);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
  document.removeEventListener("visibilitychange", onVisibility);
  document.removeEventListener("fullscreenchange", onFullscreenChange);
});

// ---- 觸控：按住畫面左半邊往左、右半邊往右；兩根手指以後按的為準（E 組） ----
function sideOf(event: PointerEvent): -1 | 1 {
  const rect = frameEl.value?.getBoundingClientRect();
  if (!rect) return 1;
  return event.clientX < rect.left + rect.width / 2 ? -1 : 1;
}
function onPointerDown(event: PointerEvent) {
  if (event.button !== 0 && event.pointerType === "mouse") return;
  sound.unlock();
  if ((event.target as HTMLElement).closest("[data-no-brake]")) return;
  if (session.value.phase !== "playing") return;
  const side = sideOf(event);
  touch.set(event.pointerId, side);
  touchLast = side;
  try {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  } catch {
    // 某些瀏覽器在指標已結束時會丟錯誤，忽略即可
  }
  applyAxis();
}
function onPointerMove(event: PointerEvent) {
  if (!touch.has(event.pointerId)) return;
  const side = sideOf(event);
  if (touch.get(event.pointerId) === side) return;
  // 先刪再放：Map 的順序就是「最新的在最後」
  touch.delete(event.pointerId);
  touch.set(event.pointerId, side);
  touchLast = side;
  applyAxis();
}
function onPointerEnd(event: PointerEvent) {
  if (!touch.delete(event.pointerId)) return;
  // 還按著別根手指時，以剩下的最後一根為準
  const rest = [...touch.values()];
  touchLast = rest.length > 0 ? rest[rest.length - 1] : 0;
  applyAxis();
}
watch(phase, (value) => {
  if (value !== "playing") {
    touch.clear();
    touchLast = 0;
    applyAxis();
  }
});

const controls = computed(() => [
  [props.text.stage.moveKey, props.text.stage.moveKeyValue],
  [props.text.stage.touchKey, props.text.stage.touchKeyValue],
  [props.text.stage.startKey, "Enter"],
  [props.text.stage.pauseKey, "P／Esc"],
  [base.stage.restart, "R"],
  [base.stage.fullscreen, "F"],
]);
const pointsText = computed(() => fmt(props.text.stage.points, { score: formatNumber(snapshot.value.score, props.locale) }));
const barButton =
  "flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 text-sm font-bold hover:bg-white/20";
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
        <button type="button" :class="`${barButton} hidden md:flex`" :disabled="phase === 'over' || phase === 'ready'" @click="togglePause()">
          <Icon name="pause" :size="18" />
          {{ base.stage.pause }}
          <kbd class="rounded bg-white/15 px-1.5 text-xs">P</kbd>
        </button>
        <button type="button" :class="barButton" :aria-label="base.stage.restart" data-testid="restart-button" @click="restart">
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
          ref="frame"
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

          <MineHud v-if="(phase === 'playing' || phase === 'dying' || phase === 'paused') && status === 'ready'" :popups="popups" :hint="hint && phase === 'playing'" :labels="base.stage" @pause="togglePause()" />
          <MineReady v-if="phase === 'ready' && status === 'ready'" @depart="depart(); click()" />
          <MineFinal
            v-if="phase === 'over'"
            :outcome="outcome"
            :base="base"
            @share="
              sharing = true;
              click();
            "
            @again="
              restart();
              click();
            "
            @back="
              click();
              exit();
            "
          />
          <MinePause
            v-if="paused && status === 'ready'"
            :base="base.pause"
            @resume="
              resume();
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
            <p class="text-[#c9cfd8]">{{ base.stage.errorBody }}</p>
            <button type="button" class="press mt-2 min-h-12 cursor-pointer rounded-full bg-express px-8 text-lg font-bold text-white" @click="attempt++">
              {{ base.stage.retry }}
            </button>
          </div>
        </div>

        <section :aria-label="text.stage.zones" class="ps-side ps-side-right rounded-2xl bg-[#2a1710] p-4 text-sm">
          <h2 class="text-lg font-extrabold">{{ text.stage.zones }}</h2>
          <ol class="mt-2 flex flex-col gap-2">
            <li v-for="(zone, index) in text.zones" :key="zone.name" :class="`flex flex-col rounded-xl px-3 py-2 ${index === snapshot.scene && phase !== 'over' ? 'bg-[#6b2f1a]' : 'bg-white/5'}`">
              <span class="font-extrabold">{{ zone.name }}</span>
              <span class="text-[#e8d4a0]">{{ zone.hint }}</span>
            </li>
          </ol>
          <p class="mt-3 border-t border-white/10 pt-3 font-extrabold tabular-nums text-[#ffd23f]" data-testid="running-total">{{ pointsText }}</p>
        </section>

        <section :aria-label="text.stage.controls" class="ps-below flex-col gap-2 px-4 pb-4 pt-3">
          <p class="text-center text-xs leading-relaxed text-[#aab3c5]">{{ text.stage.touchHint }}</p>
        </section>
      </div>

      <MineShare
        v-if="sharing && outcome && snapshot.result"
        :text="text"
        :base="base"
        :locale="locale"
        :result="snapshot.result"
        :new-score="outcome.newScore"
        :new-depth="outcome.newDepth"
        @close="sharing = false"
      />
    </div>
  </Teleport>
</template>
