<script setup lang="ts">
import type { SceneHandle } from "~/games/monk-soup-tower/scene";
import { GAME, type GameContext, type GameText } from "~/games/monk-soup-tower/shared";
import { MonkSound } from "~/games/monk-soup-tower/sound";
import { DRAW } from "@/lib/games/monk-soup-tower/config";
import type { Vec2 } from "@/lib/games/monk-soup-tower/layouts";
import { SUMMIT_FLOOR, type SaveOutcome } from "@/lib/games/monk-soup-tower/records";
import { recordRun } from "@/lib/games/monk-soup-tower/records-store";
import { idealLine } from "@/lib/games/monk-soup-tower/solver";
import { MonkSession, type LineCheck, type RunResult, type SessionEvent, type Snapshot } from "@/lib/games/monk-soup-tower/session";
import { soundFor } from "@/lib/games/monk-soup-tower/sound-mix";
import type { Mode } from "@/lib/games/monk-soup-tower/tower";
import { reportPlay } from "@/lib/play-count/client";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { musicOffPref, mutedPref, readMusicOff, readMuted } from "@/lib/sound-pref";

/**
 * 遊戲主畫面。按下出發後整頁換成這個畫面（網址不變，I4）：
 * 直式的 3D 遊戲框（three.js 場景＋HTML 介面疊在上面）；電腦把遊戲框放在中間，兩側是山霧背景（F11）。
 * 畫面上只有層數、聲音鈕、暫停鈕、湯量、溫度（F2）；沒有網站選單與廣告（I6）。
 * 只在瀏覽器端建立（介紹頁按出發才下載這個元件、three.js 和音效）。
 */
const props = defineProps<{ locale: Locale; text: GameText; dict: Dictionary; mode: Mode; seed: number | null }>();
const emit = defineEmits<{ exit: [] }>();

const HISTORY_FLAG = "monkSoupTowerGame";
const base = props.dict.preciseStop;
const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");

const session = shallowRef(new MonkSession(props.mode, props.seed, reduced.value));
const snapshot = shallowRef<Snapshot>(session.value.snapshot());
const game = computed<GameContext>(() => ({ session: session.value, snapshot, text: props.text, locale: props.locale }));
provide(GAME, game);

const phase = computed(() => snapshot.value.phase);
const status = ref<"loading" | "ready" | "error">("loading");
const attempt = ref(0);
const outcome = shallowRef<SaveOutcome | null>(null);
const sharing = ref(false);
const toast = ref<{ id: number; text: string } | null>(null);
const card = ref<{ id: number; floor: number; visible: boolean } | null>(null);
const spillPop = ref<{ id: number; amount: number } | null>(null);
const drawing = ref(false);

const canvasEl = useTemplateRef<HTMLDivElement>("canvas");
let scene: SceneHandle | null = null;
let counter = 0;
const timers = new Set<number>();
function later(callback: () => void, ms: number) {
  const timer = window.setTimeout(() => {
    timers.delete(timer);
    callback();
  }, ms);
  timers.add(timer);
}

function showToast(text: string) {
  const id = ++counter;
  toast.value = { id, text };
  later(() => {
    if (toast.value?.id === id) toast.value = null;
  }, 1600);
}

/** 層數牌（G1）：淡入 0.3 秒、停 0.8 秒、淡出 0.3 秒 */
function showCard(floor: number) {
  const id = ++counter;
  card.value = { id, floor, visible: false };
  requestAnimationFrame(() => {
    if (card.value?.id === id) card.value = { ...card.value, visible: true };
  });
  later(() => {
    if (card.value?.id === id) card.value = { ...card.value, visible: false };
  }, 1100);
  later(() => {
    if (card.value?.id === id) card.value = null;
  }, 1500);
}

// ---- 音效：遊戲畫面掛上（按了出發）才建立並載入音檔，離開時關掉 ----
const sound = new MonkSound(readMuted(), !readMusicOff());
void sound.load();
const muted = usePref(mutedPref);
watch(muted, (value) => sound.setMuted(value));
const musicOff = usePref(musicOffPref);
watch(musicOff, (value) => sound.setMusicOn(!value));
const click = () => sound.play("ui-click.mp3");

// ---- 進出遊戲畫面：隱藏網站其他部分、接管返回鍵 ----
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
// 第 1 層的層數牌等場景就緒才開始播（場景載入慢時才不會在第一格畫面前就消失，Codex 審查第 3 輪）
watch(status, (value, before) => {
  if (value === "ready" && before !== "ready") showCard(session.value.floor);
});
onBeforeUnmount(() => {
  closed = true;
  window.removeEventListener("popstate", onPopState);
  delete document.documentElement.dataset.playing;
  for (const timer of timers) window.clearTimeout(timer);
  window.clearTimeout(spillTimer);
  sound.dispose();
  if (import.meta.dev) {
    const globals = window as unknown as Record<string, unknown>;
    if ((globals.__monkSoupTower as { session?: unknown } | undefined)?.session === session.value) delete globals.__monkSoupTower;
  }
});

async function exit() {
  if (leaving.value || closed) return;
  leaving.value = true;
  await historyEntry;
  if (closed) return;
  if (hasGameEntry()) window.history.back();
  else close();
}

// ---- 場景：這時才載入 three.js；按「重試」時重新建立。場景是遊戲的時鐘 ----
let soupShown = 1000;
let spillTotal = 0;
let spillTimer = 0;
function onEvents(events: SessionEvent[]) {
  for (const event of events) {
    if (event.type === "spill") sound.spill();
    else if (event.type === "floor") {
      if (event.floor > 1) showCard(event.floor);
      const name = soundFor(event);
      if (name) sound.play(name);
    } else if (event.type === "over") finishRun(event.result);
    else {
      const name = soundFor(event);
      if (name) sound.play(name);
    }
  }
}

function finishRun(result: RunResult) {
  const best = result.outcome === "summit" && result.score !== null ? { score: result.score, timeMs: result.timeMs } : null;
  outcome.value = recordRun({ mode: result.mode, floor: result.outcome === "summit" ? SUMMIT_FLOOR : result.floor, best });
  reportPlay("monk-soup-tower");
  if (result.outcome === "summit") sound.finale(outcome.value.newBest, reduced.value);
}

let brushSpeed = 0;
function onFrame() {
  const current = session.value;
  const next = current.snapshot();
  snapshot.value = next;
  sound.update(drawing.value ? brushSpeed : null, next.phase === "walk" ? next.tilt : null);
  brushSpeed *= 0.85;
  // 湯量數字閃一下、「−n」往上飄（G2）：灑完 0.35 秒內合計成一個
  const pct = Math.round(next.soup / 10);
  const before = Math.round(soupShown / 10);
  if (pct < before && next.phase !== "over") {
    spillTotal += before - pct;
    window.clearTimeout(spillTimer);
    spillTimer = window.setTimeout(() => {
      if (!reduced.value && spillTotal > 0) spillPop.value = { id: ++counter, amount: spillTotal };
      spillTotal = 0;
    }, 350);
  }
  soupShown = next.soup;
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
      import("~/games/monk-soup-tower/scene")
        .then(({ createScene }) => {
          if (cancelled) return;
          handle = createScene({
            parent,
            session: () => session.value,
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
          if (import.meta.dev) (window as unknown as Record<string, unknown>).__monkSoupTower = { session: session.value, scene: handle, sound, idealLine };
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
// 遊戲中途切換減少動態效果：場景和遊戲流程一起換（G6，Codex 審查第 2 輪）
watch(reduced, (value) => {
  scene?.setReducedMotion(value);
  session.value.setReduced(value);
});

// ---- 操作 ----
function restart(sameTower = false) {
  outcome.value = null;
  sharing.value = false;
  toast.value = null;
  sound.cancelScheduled();
  holds.clear();
  cancelDraft();
  session.value.restart(sameTower);
  soupShown = 1000;
  // 上一局還沒顯示的扣湯飄字不能帶到新的一局
  window.clearTimeout(spillTimer);
  spillTotal = 0;
  spillPop.value = null;
  // 從暫停選單重來時，暫停讓聲音停住了：新的一局要恢復（Codex 審查第 1 輪）
  sound.setActive(!document.hidden);
  if (import.meta.dev) (window as unknown as Record<string, unknown>).__monkSoupTower = { session: session.value, scene, sound, idealLine };
  snapshot.value = session.value.snapshot();
  showCard(1);
}
function pause() {
  const current = session.value;
  if (current.phase === "over" || current.phase === "paused") return;
  holds.clear();
  cancelDraft();
  current.pause();
  snapshot.value = current.snapshot();
  sound.setActive(false);
}
function resume() {
  session.value.resume();
  snapshot.value = session.value.snapshot();
  sound.setActive(!document.hidden);
}
function togglePause() {
  if (session.value.phase === "paused") resume();
  else pause();
}
function redraw() {
  if (session.value.redraw()) {
    click();
    snapshot.value = session.value.snapshot();
  }
}

// ---- 畫線（B1–B3、E1、E2）與按住走（E3） ----
const holds = new Set<number | "key">();
let draft: { id: number; points: Vec2[]; lastX: number; lastY: number; lastT: number } | null = null;

const isUi = (event: Event) => (event.target as HTMLElement | null)?.closest?.("[data-ui]") != null;
/** 手機的筆尖在手指上方 56 px（E1）；滑鼠就在游標下（E2） */
const tipOffset = (event: PointerEvent) => (event.pointerType === "touch" || event.pointerType === "pen" ? DRAW.touchOffsetPx : 0);

function applyHold() {
  session.value.setHolding(holds.size > 0);
  snapshot.value = session.value.snapshot();
}

function cancelDraft() {
  draft = null;
  drawing.value = false;
  scene?.setDraft(null, null);
}

function onPointerDown(event: PointerEvent) {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  sound.unlock();
  if (isUi(event) || status.value !== "ready") return;
  const current = session.value;
  if (current.phase === "draw") {
    if (draft) return;
    const p = scene?.pick(event.clientX, event.clientY - tipOffset(event)) ?? null;
    if (!p || !current.canStartAt(p)) {
      showToast(props.text.draw.missStart);
      return;
    }
    current.beginLine();
    draft = { id: event.pointerId, points: [p], lastX: event.clientX, lastY: event.clientY, lastT: performance.now() };
    drawing.value = true;
    scene?.setDraft(draft.points, p);
  } else if (current.phase === "ready" || current.phase === "walk") {
    holds.add(event.pointerId);
    applyHold();
  } else return;
  try {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  } catch {
    // 指標已結束時有些瀏覽器會丟錯誤
  }
}

function onPointerMove(event: PointerEvent) {
  if (!draft || event.pointerId !== draft.id) return;
  const p = scene?.pick(event.clientX, event.clientY - tipOffset(event)) ?? null;
  if (!p) return;
  const now = performance.now();
  const moved = Math.hypot(event.clientX - draft.lastX, event.clientY - draft.lastY);
  if (now > draft.lastT) brushSpeed = (moved / (now - draft.lastT)) * 1000;
  draft.lastX = event.clientX;
  draft.lastY = event.clientY;
  draft.lastT = now;
  const last = draft.points[draft.points.length - 1]!;
  if (Math.hypot(p.x - last.x, p.z - last.z) < 0.04) {
    scene?.setDraft(draft.points, p);
    return;
  }
  // 點數到上限：換掉最後一點，終點仍跟著筆尖（Codex 審查第 1 輪）
  if (draft.points.length >= DRAW.maxRawPoints) draft.points[draft.points.length - 1] = p;
  else draft.points.push(p);
  scene?.setDraft(draft.points, p);
}

function lineMessage(check: LineCheck) {
  if (check === "start") showToast(props.text.draw.missStart);
  else if (check !== "ok") showToast(props.text.draw.missGoal);
}

function onPointerEnd(event: PointerEvent) {
  if (draft && event.pointerId === draft.id) {
    const points = draft.points;
    // 終點判定用實際放開的位置（最後一次 pointermove 可能和放開的位置不同，B2）
    if (event.type === "pointerup") {
      const end = scene?.pick(event.clientX, event.clientY - tipOffset(event)) ?? null;
      const last = points[points.length - 1]!;
      if (end && Math.hypot(end.x - last.x, end.z - last.z) > 1e-6) {
        if (points.length >= DRAW.maxRawPoints) points[points.length - 1] = end;
        else points.push(end);
      }
    }
    cancelDraft();
    if (event.type !== "pointerup") {
      // 取消或失去指標：清掉這條線，不判定
      session.value.setLine([]);
    } else lineMessage(session.value.setLine(points));
    snapshot.value = session.value.snapshot();
    return;
  }
  if (holds.delete(event.pointerId)) applyHold();
}

// ---- 鍵盤（E4）：空白鍵按住走、R 重畫、Esc 暫停 ----
function onKeyDown(event: KeyboardEvent) {
  if (event.metaKey || event.ctrlKey || event.altKey || sharing.value) return;
  const target = event.target as HTMLElement | null;
  const onButton = typeof target?.closest === "function" && target.closest("button, a, input, textarea, select") != null;
  const space = event.key === " " || event.key === "Spacebar";
  if (space && !onButton) event.preventDefault();
  sound.unlock();
  const current = session.value.phase;
  if (space && !onButton) {
    if (event.repeat) return;
    if (current === "ready" || current === "walk") {
      holds.add("key");
      applyHold();
    }
    return;
  }
  if (event.repeat) return;
  if (event.key === "Escape") togglePause();
  else if ((event.key === "r" || event.key === "R") && current === "ready") redraw();
}
function onKeyUp(event: KeyboardEvent) {
  if ((event.key === " " || event.key === "Spacebar") && holds.delete("key")) applyHold();
}
/** 切到背景分頁、視窗失焦：自動暫停（E6） */
function onVisibility() {
  if (document.hidden) {
    pause();
    // 結算畫面不會暫停，聲音也要停（M3）
    sound.setActive(false);
  } else sound.setActive(session.value.phase !== "paused");
}
function onBlur() {
  pause();
}
onMounted(() => {
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onVisibility);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
  window.removeEventListener("blur", onBlur);
  document.removeEventListener("visibilitychange", onVisibility);
});

watch(phase, (value) => {
  if (value !== "ready" && value !== "walk") {
    holds.clear();
    session.value.setHolding(false);
  }
  if (value !== "draw") cancelDraft();
});

const hudPhases = new Set<Snapshot["phase"]>(["intro", "draw", "ready", "walk", "paused", "falling", "spilled", "summit"]);
const showHud = computed(() => status.value === "ready" && hudPhases.has(phase.value));
const keyHints = computed(() => [
  [props.text.stage.drawKey, props.text.stage.drawValue],
  [props.text.stage.walkKey, "Space"],
  [props.text.stage.redrawKey, "R"],
  [props.text.stage.pauseKey, "Esc"],
]);
</script>

<template>
  <!-- 掛到 body 底下，蓋住整個網站（頁首、說明、廣告都由 CSS 隱藏） -->
  <Teleport to="body">
    <div data-game-stage data-testid="game-stage" :data-phase="phase" :data-mode="mode" :data-reduced-motion="reduced" class="mst-stage fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
      <div class="mst-backdrop" aria-hidden="true" />
      <div
        ref="frame"
        class="mst-frame"
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
        <div ref="canvas" class="absolute inset-0" data-testid="scene" />

        <MonkHud v-if="showHud" :labels="base.stage" :spill="spillPop" :drawing="drawing" @pause="togglePause(); click()" @redraw="redraw" />
        <MonkFloorCard v-if="card && status === 'ready' && phase !== 'over' && phase !== 'paused'" :floor="card.floor" :visible="card.visible" />
        <p v-if="toast && status === 'ready' && phase !== 'paused' && phase !== 'over'" :key="toast.id" role="status" data-testid="draw-toast" class="mst-toast">{{ toast.text }}</p>

        <MonkPause
          v-if="phase === 'paused' && status === 'ready'"
          :base="base.pause"
          @resume="
            resume();
            click();
          "
          @restart="
            click();
            restart();
          "
          @back="
            click();
            exit();
          "
        />
        <MonkFinal
          v-if="phase === 'over' && snapshot.result"
          :outcome="outcome"
          :base="base"
          @share="
            sharing = true;
            click();
          "
          @again="
            click();
            restart();
          "
          @back="
            click();
            exit();
          "
        />

        <div v-if="status === 'loading'" data-ui class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#cfe2dd] text-[#23302d]" role="status">
          <span class="ps-spinner size-10 rounded-full border-4 border-[#23302d]/20 border-t-[#a8372c]" />
          <p class="font-bold">{{ text.stage.loading }}</p>
        </div>
        <div v-if="status === 'error'" data-ui class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#23302d] p-6 text-center text-white" role="alert" data-testid="game-error">
          <p class="text-xl font-extrabold">{{ base.stage.errorTitle }}</p>
          <p class="text-[#c9cfd8]">{{ base.stage.errorBody }}</p>
          <button type="button" class="press mt-2 min-h-12 cursor-pointer rounded-full bg-[#a8372c] px-8 text-lg font-bold text-white" @click="attempt++">
            {{ base.stage.retry }}
          </button>
          <button type="button" class="min-h-11 cursor-pointer px-4 font-bold underline" @click="exit">{{ base.stage.back }}</button>
        </div>

      </div>

      <MonkShare v-if="sharing && outcome && snapshot.result && snapshot.result.score !== null" :text="text" :base="base" :locale="locale" :result="snapshot.result" :new-record="outcome.newBest" @close="sharing = false" />

      <dl class="mst-keys" :aria-label="text.stage.controls">
        <div v-for="[label, key] in keyHints" :key="label" class="flex items-center gap-2">
          <dt><kbd>{{ key }}</kbd></dt>
          <dd>{{ label }}</dd>
        </div>
      </dl>
    </div>
  </Teleport>
</template>
