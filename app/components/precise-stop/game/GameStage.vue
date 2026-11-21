<script setup lang="ts">
import type { SceneHandle } from "~/games/precise-stop/scene";
import { GAME, judgementColor, u, type GameContext, type GameText } from "~/games/precise-stop/shared";
import { GameSound } from "~/games/precise-stop/sound";
import { FX } from "@/lib/games/precise-stop/config";
import type { SaveOutcome } from "@/lib/games/precise-stop/records";
import { recordRun } from "@/lib/games/precise-stop/records-store";
import { dailyRoute, freeRoute, taiwanDateKey, type Mode } from "@/lib/games/precise-stop/route";
import { GameSession, type SessionEvent, type Snapshot } from "@/lib/games/precise-stop/session";
import { judgementSound } from "@/lib/games/precise-stop/sound-mix";
import { stationName } from "@/lib/games/precise-stop/stations";
import { VIEW } from "@/lib/games/precise-stop/view";
import { fmt, formatNumber } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/locales";
import { musicOffPref, mutedPref, readMusicOff, readMuted } from "@/lib/sound-pref";

/**
 * 遊戲主畫面。按下出發後整頁換成這個畫面（網址不變）：
 * 上方是返回與控制列，中間是遊戲，旁邊是本局路線。
 * 只在瀏覽器端建立（介紹頁按出發才下載這個元件、Phaser 和音效）。
 */
const props = defineProps<{ mode: Mode; locale: Locale; text: GameText }>();
/** 離開遊戲、回到介紹頁。scrollToBoard：是否捲回出發看板（換模式時） */
const emit = defineEmits<{ exit: [scrollToBoard: boolean] }>();

type Effect = { id: number; kind: "zoom" | "judged"; event?: Extract<SessionEvent, { type: "judged" }> };

const HISTORY_FLAG = "preciseStopGame";
const createSession = (mode: Mode) => new GameSession(mode === "daily" ? dailyRoute() : freeRoute());

// ---- 一局的狀態：session 只有自由行駛「再玩一次」時會換新的 ----
const session = shallowRef(createSession(props.mode));
const snapshot = shallowRef<Snapshot>(session.value.getSnapshot());
const route = computed(() => session.value.route);
watch(
  session,
  (current, _, onCleanup) => {
    snapshot.value = current.getSnapshot();
    onCleanup(current.subscribe(() => (snapshot.value = current.getSnapshot())));
  },
  { immediate: true },
);

const game = computed<GameContext>(() => ({
  session: session.value,
  route: route.value,
  snapshot,
  text: props.text,
  locale: props.locale,
}));
provide(GAME, game);

/*
 * 畫面上只取會變動的那幾個值。snapshot 行駛中每一格都會換，
 * 用 computed 隔開，值沒變時這個元件不會重新渲染（逐格更新只發生在儀表等子元件）。
 */
const phase = computed(() => snapshot.value.phase);
const paused = computed(() => snapshot.value.paused);
const index = computed(() => snapshot.value.index);
const results = computed(() => snapshot.value.results);
const total = computed(() => snapshot.value.total);
const rain = computed(() => snapshot.value.stop.rain);
const farFromMark = computed(() => snapshot.value.train.distance > (VIEW.width - VIEW.noseFarX) / VIEW.farPpm);
const beforeZoomEnd = computed(() => snapshot.value.train.distance > 3.5);

const status = ref<"loading" | "ready" | "error">("loading");
const attempt = ref(0);
const outcome = shallowRef<SaveOutcome | null>(null);
const sharing = ref(false);
const effect = shallowRef<Effect | null>(null);
const shake = ref(0);
const fullscreen = ref(false);
const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
const canFullscreen = typeof document.documentElement.requestFullscreen === "function";

const stageEl = useTemplateRef<HTMLDivElement>("stage");
const canvasEl = useTemplateRef<HTMLDivElement>("canvas");
const shakeEl = useTemplateRef<HTMLDivElement>("shaker");
let scene: SceneHandle | null = null;
let exitScroll = false;
const pointers = new Set<number>();
const keysHeld = new Set<string>();

// ---- 音效：遊戲畫面掛上（按了出發）才建立並載入音檔，離開時關掉 ----
const sound = new GameSound(readMuted(), !readMusicOff());
void sound.load();
if (import.meta.dev) (window as unknown as Record<string, unknown>).__preciseStopSound = sound;
const muted = usePref(mutedPref);
const musicOff = usePref(musicOffPref);
watch(muted, (value) => sound.setMuted(value));
watch(musicOff, (value) => sound.setMusicOn(!value));

// 行駛聲、煞車聲跟著每次狀態更新；暫停或分頁在背景時全部停止
watch(
  session,
  (current, _, onCleanup) => {
    const sync = () => {
      const state = current.getSnapshot();
      sound.setActive(!state.paused && !document.hidden);
      sound.update(state);
    };
    sync();
    onCleanup(current.subscribe(sync));
  },
  { immediate: true },
);

/** 按鈕點擊音：在動作之後呼叫（例如從暫停恢復後聲音才出得來） */
const click = () => sound.play("ui-click.mp3");

// ---- 進出遊戲畫面：隱藏網站其他部分、接管返回鍵 ----
const onPopState = () => emit("exit", exitScroll);
onMounted(() => {
  document.documentElement.dataset.playing = "1";
  // 進遊戲時多記一筆瀏覽紀錄（網址相同），返回鍵會回到介紹而不是離開網站
  if (!(window.history.state as Record<string, unknown> | null)?.[HISTORY_FLAG]) {
    window.history.pushState({ ...(window.history.state ?? {}), [HISTORY_FLAG]: true }, "");
  }
  window.addEventListener("popstate", onPopState);
});
onBeforeUnmount(() => {
  window.removeEventListener("popstate", onPopState);
  delete document.documentElement.dataset.playing;
  // Phaser 場景由上面建立場景的 watch 收掉（元件卸載時會執行它的 onCleanup）
  // 測試掛勾 __preciseStopSound 保留著，讓測試確認離開後音效已關閉（只在開發版）
  sound.dispose();
});

function exit(scrollToBoard: boolean) {
  exitScroll = scrollToBoard;
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  window.history.back();
}

// ---- 建立 Phaser 場景（這時才載入 Phaser）；按「重試」或換新的一局時重新建立 ----
// immediate 的第一次會在 setup 當下同步執行（那時畫布的節點還沒掛上），所以等掛載後才開始監看
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

      const { locale, text } = props;
      const fontFamily = getComputedStyle(document.body).fontFamily;
      const names = current.route.stops.map((stop) => stationName(stop.station, locale));
      const glyphs = [text.hud.stopBadge, text.judgement.perfect, text.judgement.good, "✓", ...names.flatMap((n) => [n.name, n.sub])].join("");

      Promise.all([
        import("~/games/precise-stop/scene"),
        // 畫布上的文字要等字型載入，不然會先用備用字型畫出來
        document.fonts?.load(`900 32px ${fontFamily}`, glyphs).catch(() => undefined),
      ])
        .then(([{ createScene }]) => {
          if (cancelled) return;
          handle = createScene({
            parent,
            session: current,
            fontFamily,
            reducedMotion: reduced.value,
            labels: {
              stopBadge: text.hud.stopBadge,
              perfect: text.judgement.perfect,
              good: text.judgement.good,
              stationName: (id) => stationName(id, locale),
            },
            // 圖片載入失敗後 Phaser 還是會跑完載入流程，這時不能把畫面改回「就緒」
            onReady: () => {
              if (!cancelled && !failed) status.value = "ready";
            },
            onError: () => {
              failed = true;
              if (!cancelled) status.value = "error";
            },
          });
          scene = handle;
          if (import.meta.dev) {
            // 給自動測試使用：讀取狀態、啟用自動駕駛
            (window as unknown as Record<string, unknown>).__preciseStop = { session: current, fx: handle.fx };
          }
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

// ---- 特效與結算 ----
let effectCounter = 0;
watch(
  session,
  (current, _, onCleanup) => {
    onCleanup(
      current.onEvent((event) => {
        if (event.type === "depart") sound.play("ui-click.mp3");
        if (event.type === "stopped") sound.play("stop.mp3");
        if (event.type === "zoom") {
          effect.value = { id: ++effectCounter, kind: "zoom" };
          sound.play("final-5m.mp3");
        }
        if (event.type === "judged") {
          sound.play(judgementSound(event.result.judgement));
          effect.value = { id: ++effectCounter, kind: "judged", event };
          if (event.result.judgement === "miss" && event.result.error > 0 && !reduced.value) shake.value += 1;
        }
        if (event.type === "depart" || event.type === "restart") effect.value = null;
        if (event.type === "final") {
          const finished = current.getSnapshot().results;
          const saved = recordRun({
            mode: current.route.mode,
            dateKey: current.route.dateKey,
            total: event.total,
            perfectStops: finished.filter((result) => result.judgement === "perfect").length,
          });
          outcome.value = saved;
          sound.finale(saved.isNewRecord, reduced.value);
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
  effect.value = null;
  sound.cancelScheduled();
  pointers.clear();
  keysHeld.clear();
  if (route.value.mode === "free") session.value = createSession("free");
  else session.value.restart();
}

const syncBrake = () => session.value.setBrake(pointers.size > 0 || keysHeld.size > 0);

function releaseAll() {
  pointers.clear();
  keysHeld.clear();
  session.value.setBrake(false);
}

function toggleFullscreen() {
  const element = stageEl.value;
  if (!element || !element.requestFullscreen) return;
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  else void element.requestFullscreen().catch(() => {});
}

const brakeKeys = new Set([" ", "Spacebar", "ArrowDown"]);
function onKeyDown(event: KeyboardEvent) {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const target = event.target as HTMLElement | null;
  const onButton = target?.closest("button, a, input, textarea, select") != null;
  const current = session.value;
  const state = current.getSnapshot();
  if (sharing.value) return;

  if (brakeKeys.has(event.key)) {
    // 空白鍵和方向鍵不捲動頁面
    event.preventDefault();
    if (event.repeat || state.paused) return;
    if (state.phase === "briefing" && event.key !== "ArrowDown") {
      if (!onButton) current.depart();
      return;
    }
    if (state.phase === "running") {
      keysHeld.add(event.key);
      syncBrake();
    }
    return;
  }
  if (event.repeat) return;
  switch (event.key) {
    case "Enter":
      // 焦點在按鈕上時讓按鈕自己處理，避免觸發兩次
      if (!onButton && !state.paused) {
        event.preventDefault();
        current.advance();
      }
      break;
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
function onKeyUp(event: KeyboardEvent) {
  if (keysHeld.delete(event.key)) syncBrake();
}
function onVisibility() {
  if (document.hidden) {
    releaseAll();
    session.value.pause();
  }
  // 結算畫面不能暫停，分頁切走時一樣要停聲音
  sound.setActive(!document.hidden && !session.value.getSnapshot().paused);
}
function onFullscreenChange() {
  fullscreen.value = document.fullscreenElement !== null;
  scene?.refresh();
}
onMounted(() => {
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", releaseAll);
  document.addEventListener("visibilitychange", onVisibility);
  document.addEventListener("fullscreenchange", onFullscreenChange);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
  window.removeEventListener("blur", releaseAll);
  document.removeEventListener("visibilitychange", onVisibility);
  document.removeEventListener("fullscreenchange", onFullscreenChange);
});

// 過站時場景輕震一下。不能重新掛載這個節點：Phaser 的畫布在裡面
watch(shake, (value) => {
  const element = shakeEl.value;
  if (!element || value === 0) return;
  element.classList.remove("ps-shake");
  void element.offsetWidth;
  element.classList.add("ps-shake");
});

// 按住遊戲框任一處煞車。用 pointer capture，手指滑出畫面也收得到放開事件。
function onPointerDown(event: PointerEvent) {
  if (event.button !== 0 && event.pointerType === "mouse") return;
  sound.unlock();
  if ((event.target as HTMLElement).closest("[data-no-brake]")) return;
  const state = session.value.getSnapshot();
  if (state.phase !== "running" || state.paused) return;
  event.preventDefault();
  try {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  } catch {
    // 某些瀏覽器在指標已結束時會丟錯誤，忽略即可
  }
  pointers.add(event.pointerId);
  syncBrake();
}
function onPointerEnd(event: PointerEvent) {
  if (pointers.delete(event.pointerId)) syncBrake();
}

// 離開行駛狀態時一律放開煞車
watch([phase, paused], ([currentPhase, isPaused]) => {
  if (currentPhase !== "running" || isPaused) {
    pointers.clear();
    keysHeld.clear();
  }
});

const modeName = computed(() => (route.value.mode === "daily" ? props.text.modes.daily : props.text.modes.free));
const showHint = computed(() => phase.value === "running" && farFromMark.value);
const judged = computed(() => (effect.value?.kind === "judged" ? effect.value.event?.result : undefined));
const multiplierNow = computed(() => results.value.at(-1)?.multiplier);
const pointsText = computed(() => fmt(props.text.stage.points, { score: formatNumber(total.value, props.locale) }));
const judgedTitle = computed(() => {
  const result = judged.value;
  if (!result) return "";
  if (result.judgement !== "miss") return props.text.judgement[result.judgement];
  return result.error > 0 ? props.text.judgement.overrun : props.text.judgement.short;
});
const judgedAnimation = computed(() => {
  if (reduced.value || !judged.value) return "";
  return judged.value.judgement === "perfect" || judged.value.judgement === "great" ? "ps-plate-pop" : "ps-plate-drop";
});
const controls = computed(() => [
  [props.text.stage.brakeKey, props.text.stage.brakeKeyValue],
  [props.text.stage.nextKey, "Enter"],
  [props.text.stage.pause, "P／Esc"],
  [props.text.stage.restart, "R"],
  [props.text.stage.fullscreen, "F"],
]);

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
        <button type="button" :class="barButton" :aria-label="text.stage.back" data-testid="back-button" @click="exit(false)">
          <Icon name="left" :size="18" />
          <span class="hidden md:inline">{{ text.stage.back }}</span>
        </button>
        <p class="min-w-0 flex-1 truncate text-center font-extrabold md:text-left md:text-lg">
          {{ text.title }} <span class="hidden font-bold text-[#aab3c5] md:inline">· {{ modeName }}</span>
        </p>
        <button type="button" :class="`${barButton} hidden md:flex`" :disabled="phase === 'final'" @click="session.togglePause()">
          <Icon name="pause" :size="18" />
          {{ text.stage.pause }}
          <kbd class="rounded bg-white/15 px-1.5 text-xs">P</kbd>
        </button>
        <button type="button" :class="barButton" :aria-label="text.stage.restart" @click="restart">
          <Icon name="restart" :size="18" />
          <span class="hidden md:inline">{{ text.stage.restart }}</span>
          <kbd class="hidden rounded bg-white/15 px-1.5 text-xs md:inline">R</kbd>
        </button>
        <button
          v-if="canFullscreen"
          type="button"
          :class="barButton"
          :aria-label="fullscreen ? text.stage.exitFullscreen : text.stage.fullscreen"
          @click="toggleFullscreen"
        >
          <Icon name="expand" :size="18" />
          <span class="hidden md:inline">{{ fullscreen ? text.stage.exitFullscreen : text.stage.fullscreen }}</span>
          <kbd class="hidden rounded bg-white/15 px-1.5 text-xs md:inline">F</kbd>
        </button>
      </div>

      <div class="ps-layout min-h-0 flex-1">
        <section :aria-label="text.stage.route" class="ps-side ps-side-left rounded-2xl bg-sign-deep p-4">
          <div class="flex items-baseline justify-between gap-2 px-1 pb-2">
            <h2 class="text-lg font-extrabold">{{ text.stage.route }}</h2>
            <span class="text-sm font-extrabold tabular-nums text-edge" data-testid="running-total">{{ pointsText }}</span>
          </div>
          <RouteList />
        </section>

        <div
          class="ps-frame"
          data-testid="game-frame"
          role="application"
          :aria-label="text.stage.gameLabel"
          @pointerdown="onPointerDown"
          @pointerup="onPointerEnd"
          @pointercancel="onPointerEnd"
          @lostpointercapture="onPointerEnd"
          @contextmenu.prevent
        >
          <div
            ref="shaker"
            class="absolute inset-x-0 top-0 overflow-hidden"
            :style="{ height: `${(340 / 560) * 100}%` }"
            data-testid="scene"
            :data-shakes="shake"
          >
            <div ref="canvas" class="ps-canvas absolute inset-0" />
            <div v-if="rain && phase !== 'briefing'" class="ps-rain absolute inset-0" />

            <div
              v-if="effect?.kind === 'zoom' && !reduced"
              :key="`zoom-${effect.id}`"
              class="pointer-events-none absolute inset-0"
              data-testid="focus-lines"
            >
              <div class="ps-flash absolute inset-0 bg-white" />
              <div class="ps-focus absolute inset-0" />
            </div>
            <div v-if="judged?.judgement === 'miss' && judged.error > 0" class="ps-vignette pointer-events-none absolute inset-0" />

            <SceneTags @pause="session.pause()" />
            <TargetHint v-if="showHint" />

            <!-- 減少動態時不做滑入淡出，改成在 3.5 m 前靜態顯示 -->
            <div
              v-if="effect?.kind === 'zoom' && phase === 'running' && (!reduced || beforeZoomEnd)"
              :key="`plate-${effect.id}`"
              :class="`pointer-events-none absolute inset-x-0 flex justify-center ${reduced ? '' : 'ps-plate-zoom'}`"
              :style="{ top: u(108) }"
              data-testid="zoom-plate"
            >
              <Plate from="#1d3a8f" to="#152b6b" :tag="text.hud.last">
                <Icon name="search" :size="22" class="text-edge" />
                {{ FX.zoomAt }} m
              </Plate>
            </div>
            <div
              v-if="judged && phase === 'judged'"
              :key="`judged-${effect?.id}`"
              :class="`pointer-events-none absolute inset-x-0 flex flex-col items-center ${judgedAnimation}`"
              :style="{ top: u(104), gap: u(10) }"
              data-testid="judgement-plate"
            >
              <Plate
                :from="judgementColor[judged.judgement].from"
                :to="judgementColor[judged.judgement].to"
                :size="judged.judgement === 'perfect' ? 36 : 32"
              >
                <Icon v-if="judged.judgement === 'perfect'" name="star" :size="24" class="text-edge" />
                {{ judgedTitle }}
              </Plate>
              <span
                v-if="judged.score > 0"
                :class="`rounded-full bg-white font-black tabular-nums text-signal ${reduced ? '' : 'ps-float'}`"
                :style="{ fontSize: u(17), padding: `${u(4)} ${u(14)}`, boxShadow: `0 ${u(3)} ${u(6)} rgba(16,19,26,0.35)` }"
              >
                +{{ formatNumber(judged.score, locale) }}
              </span>
            </div>
          </div>

          <Hud v-if="phase === 'running'" />
          <JudgedPanel v-if="phase === 'judged'" @next="session.next()" />
          <Briefing v-if="phase === 'briefing' && status === 'ready'" @depart="session.depart()" />
          <FinalPanel
            v-if="phase === 'final'"
            :outcome="outcome"
            @share="
              sharing = true;
              click();
            "
            @again="
              restart();
              click();
            "
            @change-mode="
              click();
              exit(true);
            "
          />
          <PauseDialog
            v-if="paused && status === 'ready'"
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
              exit(false);
            "
          />

          <div v-if="status === 'loading'" class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-canvas" data-no-brake role="status">
            <span class="ps-spinner size-10 rounded-full border-4 border-white/20 border-t-edge" />
            <p class="font-bold text-[#c9cfd8]">{{ text.stage.loading }}</p>
          </div>
          <div
            v-if="status === 'error'"
            class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-canvas p-6 text-center"
            data-no-brake
            role="alert"
            data-testid="game-error"
          >
            <p class="text-xl font-extrabold">{{ text.stage.errorTitle }}</p>
            <p class="text-[#c9cfd8]">{{ text.stage.errorBody }}</p>
            <button type="button" class="press mt-2 min-h-12 cursor-pointer rounded-full bg-express px-8 text-lg font-bold text-white" @click="attempt++">
              {{ text.stage.retry }}
            </button>
          </div>
        </div>

        <section :aria-label="text.stage.controls" class="ps-side ps-side-right rounded-2xl bg-[#1b2030] p-4 text-sm">
          <h2 class="text-lg font-extrabold">{{ text.stage.controls }}</h2>
          <dl class="mt-2 flex flex-col gap-2">
            <div v-for="[label, value] in controls" :key="label" class="flex justify-between gap-3">
              <dt class="font-bold">{{ label }}</dt>
              <dd class="text-right text-[#c9cfd8]">{{ value }}</dd>
            </div>
          </dl>
          <p class="mt-3 border-t border-[#2a3040] pt-3 leading-relaxed text-[#aab3c5]">{{ text.stage.backHint }}</p>
        </section>

        <section :aria-label="text.stage.route" class="ps-below flex-col gap-3 px-4 pb-4 pt-3">
          <div class="flex items-baseline justify-between gap-2">
            <h2 class="font-extrabold">{{ text.stage.route }}</h2>
            <span class="text-sm font-extrabold tabular-nums text-edge">
              {{ pointsText }}{{ multiplierNow && multiplierNow > 1 ? ` · ×${multiplierNow.toFixed(1)}` : "" }}
            </span>
          </div>
          <div class="rounded-2xl bg-sign-deep px-1.5 pb-2.5 pt-3">
            <RouteStrip :route="route" :current="phase === 'final' ? 5 : index" :detailed="false" :text="text" :locale="locale" />
          </div>
          <p class="text-center text-xs leading-relaxed text-[#aab3c5]">{{ text.stage.touchHint }}</p>
        </section>
      </div>

      <SharePanel
        v-if="sharing && outcome"
        :text="text"
        :locale="locale"
        :route="route"
        :results="results"
        :total="total"
        :new-record="outcome.isNewRecord"
        :date-key="route.dateKey ?? taiwanDateKey()"
        @close="sharing = false"
      />
    </div>
  </Teleport>
</template>
