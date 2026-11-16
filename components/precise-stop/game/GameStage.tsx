"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/Icon";
import { FX } from "@/lib/games/precise-stop/config";
import { recordRun } from "@/lib/games/precise-stop/records-store";
import type { SaveOutcome } from "@/lib/games/precise-stop/records";
import { dailyRoute, freeRoute, taiwanDateKey, type Mode } from "@/lib/games/precise-stop/route";
import { GameSession, type SessionEvent } from "@/lib/games/precise-stop/session";
import { stationName } from "@/lib/games/precise-stop/stations";
import { VIEW } from "@/lib/games/precise-stop/view";
import { fmt, formatNumber } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/locales";
import {
  Briefing,
  FinalPanel,
  Hud,
  JudgedPanel,
  PauseDialog,
  RouteList,
  RouteStrip,
  SceneTags,
  TargetHint,
} from "./panels";
import type { SceneHandle } from "./scene";
import { SharePanel } from "./SharePanel";
import { useClientValue, useHydrated, useMediaQuery } from "@/lib/use-client";
import { judgementColor, Plate, u, useSnapshot, type GameText } from "./shared";

type Props = {
  mode: Mode;
  locale: Locale;
  text: GameText;
  /** 離開遊戲、回到介紹頁。scrollToBoard：是否捲回出發看板（換模式時） */
  onExit(scrollToBoard: boolean): void;
};

type Effect = { id: number; kind: "zoom" | "judged"; event?: Extract<SessionEvent, { type: "judged" }> };

const HISTORY_FLAG = "preciseStopGame";

function createSession(mode: Mode) {
  return new GameSession(mode === "daily" ? dailyRoute() : freeRoute());
}

/**
 * 遊戲主畫面。按下出發後整頁換成這個畫面（網址不變）：
 * 上方是返回與控制列，中間是遊戲，旁邊是本局路線。
 */
export default function GameStage({ mode, locale, text, onExit }: Props) {
  const [session, setSession] = useState(() => createSession(mode));
  const snapshot = useSnapshot(session);
  const route = session.route;

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null);
  const [sharing, setSharing] = useState(false);
  const [effect, setEffect] = useState<Effect | null>(null);
  const [shake, setShake] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const mounted = useHydrated();
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const canFullscreen =
    useClientValue(() => typeof document.documentElement.requestFullscreen === "function") ?? false;

  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const shakeRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneHandle | null>(null);
  const exitScroll = useRef(false);
  const pointers = useRef(new Set<number>());
  const keysHeld = useRef(new Set<string>());

  // ---- 進出遊戲畫面：隱藏網站其他部分、接管返回鍵 ----
  useEffect(() => {
    document.documentElement.dataset.playing = "1";
    // 進遊戲時多記一筆瀏覽紀錄（網址相同），返回鍵會回到介紹而不是離開網站
    if (!(window.history.state as Record<string, unknown> | null)?.[HISTORY_FLAG]) {
      window.history.pushState({ ...(window.history.state ?? {}), [HISTORY_FLAG]: true }, "");
    }
    const onPopState = () => onExit(exitScroll.current);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      delete document.documentElement.dataset.playing;
    };
  }, [onExit]);

  const exit = useCallback((scrollToBoard: boolean) => {
    exitScroll.current = scrollToBoard;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    window.history.back();
  }, []);

  // ---- 建立 Phaser 場景（這時才載入 Phaser） ----
  useEffect(() => {
    const parent = canvasRef.current;
    if (!parent) return;
    let cancelled = false;
    let handle: SceneHandle | null = null;
    let failed = false;
    setStatus("loading");

    const fontFamily = getComputedStyle(document.body).fontFamily;
    const names = route.stops.map((stop) => stationName(stop.station, locale));
    const glyphs = [text.hud.stopBadge, text.judgement.perfect, text.judgement.good, "✓", ...names.flatMap((n) => [n.name, n.sub])].join("");

    Promise.all([
      import("./scene"),
      // 畫布上的文字要等字型載入，不然會先用備用字型畫出來
      document.fonts?.load(`900 32px ${fontFamily}`, glyphs).catch(() => undefined),
    ])
      .then(([{ createScene }]) => {
        if (cancelled) return;
        handle = createScene({
          parent,
          session,
          fontFamily,
          reducedMotion: reduced,
          labels: {
            stopBadge: text.hud.stopBadge,
            perfect: text.judgement.perfect,
            good: text.judgement.good,
            stationName: (id) => stationName(id, locale),
          },
          // 圖片載入失敗後 Phaser 還是會跑完載入流程，這時不能把畫面改回「就緒」
          onReady: () => !cancelled && !failed && setStatus("ready"),
          onError: () => {
            failed = true;
            if (!cancelled) setStatus("error");
          },
        });
        sceneRef.current = handle;
        if (process.env.NODE_ENV !== "production") {
          // 給自動測試使用：讀取狀態、啟用自動駕駛
          (window as unknown as Record<string, unknown>).__preciseStop = { session, fx: handle.fx };
        }
      })
      .catch(() => !cancelled && setStatus("error"));

    const observer = new ResizeObserver(() => handle?.refresh());
    observer.observe(parent);
    return () => {
      cancelled = true;
      observer.disconnect();
      handle?.destroy();
      sceneRef.current = null;
    };
    // attempt：按「重試」時重新建立
  }, [session, attempt, locale, route, text, mounted, reduced]);

  // ---- 特效與結算 ----
  useEffect(() => {
    let counter = 0;
    return session.onEvent((event) => {
      if (event.type === "zoom") setEffect({ id: ++counter, kind: "zoom" });
      if (event.type === "judged") {
        setEffect({ id: ++counter, kind: "judged", event });
        if (event.result.judgement === "miss" && event.result.error > 0 && !reduced) {
          setShake((value) => value + 1);
        }
      }
      if (event.type === "depart" || event.type === "restart") setEffect(null);
      if (event.type === "final") {
        const results = session.getSnapshot().results;
        setOutcome(
          recordRun({
            mode: route.mode,
            dateKey: route.dateKey,
            total: event.total,
            perfectStops: results.filter((result) => result.judgement === "perfect").length,
          }),
        );
      }
    });
  }, [session, route, reduced]);

  // ---- 操作 ----
  const restart = useCallback(() => {
    setOutcome(null);
    setSharing(false);
    setEffect(null);
    pointers.current.clear();
    keysHeld.current.clear();
    if (route.mode === "free") setSession(createSession("free"));
    else session.restart();
  }, [route.mode, session]);

  const syncBrake = useCallback(() => {
    session.setBrake(pointers.current.size > 0 || keysHeld.current.size > 0);
  }, [session]);

  const releaseAll = useCallback(() => {
    pointers.current.clear();
    keysHeld.current.clear();
    session.setBrake(false);
  }, [session]);

  const toggleFullscreen = useCallback(() => {
    const element = stageRef.current;
    if (!element || !element.requestFullscreen) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void element.requestFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    const brakeKeys = new Set([" ", "Spacebar", "ArrowDown"]);
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const onButton = target?.closest("button, a, input, textarea, select") !== null;
      const state = session.getSnapshot();
      if (sharing) return;

      if (brakeKeys.has(event.key)) {
        // 空白鍵和方向鍵不捲動頁面
        event.preventDefault();
        if (event.repeat) return;
        if (state.paused) return;
        if (state.phase === "briefing" && event.key !== "ArrowDown") {
          if (!onButton) session.depart();
          return;
        }
        if (state.phase === "running") {
          keysHeld.current.add(event.key);
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
            session.advance();
          }
          break;
        case "p":
        case "P":
          session.togglePause();
          break;
        case "Escape":
          // 全螢幕時 Esc 先由瀏覽器用來離開全螢幕
          if (!document.fullscreenElement) session.togglePause();
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
      if (keysHeld.current.delete(event.key)) syncBrake();
    }
    function onVisibility() {
      if (document.hidden) {
        releaseAll();
        session.pause();
      }
    }
    function onFullscreenChange() {
      setFullscreen(document.fullscreenElement !== null);
      sceneRef.current?.refresh();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", releaseAll);
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", releaseAll);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [session, sharing, restart, syncBrake, releaseAll, toggleFullscreen]);

  // 過站時場景輕震一下。不能用 key 重新掛載：Phaser 的畫布在這個節點裡面
  useEffect(() => {
    const element = shakeRef.current;
    if (!element || shake === 0) return;
    element.classList.remove("ps-shake");
    void element.offsetWidth;
    element.classList.add("ps-shake");
  }, [shake]);

  // 按住遊戲框任一處煞車。用 pointer capture，手指滑出畫面也收得到放開事件。
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    if ((event.target as HTMLElement).closest("[data-no-brake]")) return;
    const state = session.getSnapshot();
    if (state.phase !== "running" || state.paused) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // 某些瀏覽器在指標已結束時會丟錯誤，忽略即可
    }
    pointers.current.add(event.pointerId);
    syncBrake();
  };
  const onPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointers.current.delete(event.pointerId)) syncBrake();
  };

  // 離開行駛狀態時一律放開煞車
  useEffect(() => {
    if (snapshot.phase !== "running" || snapshot.paused) {
      pointers.current.clear();
      keysHeld.current.clear();
    }
  }, [snapshot.phase, snapshot.paused]);

  const modeName = route.mode === "daily" ? text.modes.daily : text.modes.free;
  const showHint =
    snapshot.phase === "running" &&
    snapshot.train.distance > (VIEW.width - VIEW.noseFarX) / VIEW.farPpm;
  const judged = effect?.kind === "judged" ? effect.event?.result : undefined;
  const multiplierNow = snapshot.results.at(-1)?.multiplier;

  const barButton =
    "flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 text-sm font-bold hover:bg-white/20";

  const stage = (
    <div
      ref={stageRef}
      data-game-stage
      data-testid="game-stage"
      data-phase={snapshot.phase}
      data-reduced-motion={reduced}
      className="on-dark fixed inset-0 z-50 flex flex-col overflow-hidden bg-canvas text-white"
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[#222838] bg-[#0b0e14] px-2 md:px-5">
        <button
          type="button"
          onClick={() => exit(false)}
          className={barButton}
          aria-label={text.stage.back}
          data-testid="back-button"
        >
          <Icon name="left" size={18} />
          <span className="hidden md:inline">{text.stage.back}</span>
        </button>
        <p className="min-w-0 flex-1 truncate text-center font-extrabold md:text-left md:text-lg">
          {text.title} <span className="hidden font-bold text-[#aab3c5] md:inline">· {modeName}</span>
        </p>
        <button
          type="button"
          onClick={() => session.togglePause()}
          className={`${barButton} hidden md:flex`}
          disabled={snapshot.phase === "final"}
        >
          <Icon name="pause" size={18} />
          {text.stage.pause}
          <kbd className="rounded bg-white/15 px-1.5 text-xs">P</kbd>
        </button>
        <button type="button" onClick={restart} className={barButton} aria-label={text.stage.restart}>
          <Icon name="restart" size={18} />
          <span className="hidden md:inline">{text.stage.restart}</span>
          <kbd className="hidden rounded bg-white/15 px-1.5 text-xs md:inline">R</kbd>
        </button>
        {canFullscreen && (
          <button
            type="button"
            onClick={toggleFullscreen}
            className={barButton}
            aria-label={fullscreen ? text.stage.exitFullscreen : text.stage.fullscreen}
          >
            <Icon name="expand" size={18} />
            <span className="hidden md:inline">
              {fullscreen ? text.stage.exitFullscreen : text.stage.fullscreen}
            </span>
            <kbd className="hidden rounded bg-white/15 px-1.5 text-xs md:inline">F</kbd>
          </button>
        )}
      </div>

      <div className="ps-layout min-h-0 flex-1">
        <section aria-label={text.stage.route} className="ps-side ps-side-left rounded-2xl bg-sign-deep p-4">
          <div className="flex items-baseline justify-between gap-2 px-1 pb-2">
            <h2 className="text-lg font-extrabold">{text.stage.route}</h2>
            <span className="text-sm font-extrabold tabular-nums text-edge" data-testid="running-total">
              {fmt(text.stage.points, { score: formatNumber(snapshot.total, locale) })}
            </span>
          </div>
          <RouteList snapshot={snapshot} route={route} text={text} locale={locale} />
        </section>

        <div
          ref={frameRef}
          className="ps-frame"
          data-testid="game-frame"
          role="application"
          aria-label={text.stage.gameLabel}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onLostPointerCapture={onPointerEnd}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div
            ref={shakeRef}
            className="absolute inset-x-0 top-0 overflow-hidden"
            style={{ height: `${(340 / 560) * 100}%` }}
            data-testid="scene"
            data-shakes={shake}
          >
            <div ref={canvasRef} className="ps-canvas absolute inset-0" />
            {snapshot.stop.rain && snapshot.phase !== "briefing" && <div className="ps-rain absolute inset-0" />}

            {effect?.kind === "zoom" && !reduced && (
              <div key={`zoom-${effect.id}`} className="pointer-events-none absolute inset-0" data-testid="focus-lines">
                <div className="ps-flash absolute inset-0 bg-white" />
                <div className="ps-focus absolute inset-0" />
              </div>
            )}
            {judged?.judgement === "miss" && judged.error > 0 && (
              <div className="ps-vignette pointer-events-none absolute inset-0" />
            )}

            <SceneTags snapshot={snapshot} text={text} locale={locale} onPause={() => session.pause()} />
            {showHint && <TargetHint snapshot={snapshot} text={text} locale={locale} />}

            {effect?.kind === "zoom" &&
              snapshot.phase === "running" &&
              // 減少動態時不做滑入淡出，改成在 3.5 m 前靜態顯示
              (!reduced || snapshot.train.distance > 3.5) && (
              <div
                key={`plate-${effect.id}`}
                className={`pointer-events-none absolute inset-x-0 flex justify-center ${reduced ? "" : "ps-plate-zoom"}`}
                style={{ top: u(108) }}
                data-testid="zoom-plate"
              >
                <Plate from="#1d3a8f" to="#152b6b" tag={text.hud.last}>
                  <Icon name="search" size={22} className="text-edge" />
                  {FX.zoomAt} m
                </Plate>
              </div>
            )}
            {judged && snapshot.phase === "judged" && (
              <div
                key={`judged-${effect?.id}`}
                className={`pointer-events-none absolute inset-x-0 flex flex-col items-center ${reduced ? "" : judged.judgement === "perfect" || judged.judgement === "great" ? "ps-plate-pop" : "ps-plate-drop"}`}
                style={{ top: u(104), gap: u(10) }}
                data-testid="judgement-plate"
              >
                <Plate
                  from={judgementColor[judged.judgement].from}
                  to={judgementColor[judged.judgement].to}
                  size={judged.judgement === "perfect" ? 36 : 32}
                >
                  {judged.judgement === "perfect" && <Icon name="star" size={24} className="text-edge" />}
                  {judged.judgement === "miss"
                    ? judged.error > 0
                      ? text.judgement.overrun
                      : text.judgement.short
                    : text.judgement[judged.judgement]}
                </Plate>
                {judged.score > 0 && (
                  <span
                    className={`rounded-full bg-white font-black tabular-nums text-signal ${reduced ? "" : "ps-float"}`}
                    style={{ fontSize: u(17), padding: `${u(4)} ${u(14)}`, boxShadow: `0 ${u(3)} ${u(6)} rgba(16,19,26,0.35)` }}
                  >
                    +{formatNumber(judged.score, locale)}
                  </span>
                )}
              </div>
            )}
          </div>

          {snapshot.phase === "running" && <Hud snapshot={snapshot} text={text} locale={locale} />}
          {snapshot.phase === "judged" && (
            <JudgedPanel
              snapshot={snapshot}
              route={route}
              text={text}
              locale={locale}
              onNext={() => session.next()}
            />
          )}
          {snapshot.phase === "briefing" && status === "ready" && (
            <Briefing
              snapshot={snapshot}
              route={route}
              text={text}
              locale={locale}
              onDepart={() => session.depart()}
            />
          )}
          {snapshot.phase === "final" && (
            <FinalPanel
              snapshot={snapshot}
              route={route}
              outcome={outcome}
              text={text}
              locale={locale}
              onShare={() => setSharing(true)}
              onAgain={restart}
              onChangeMode={() => exit(true)}
            />
          )}
          {snapshot.paused && status === "ready" && (
            <PauseDialog
              snapshot={snapshot}
              text={text}
              locale={locale}
              onResume={() => session.resume()}
              onRestart={restart}
              onBack={() => exit(false)}
            />
          )}

          {status === "loading" && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-canvas"
              data-no-brake
              role="status"
            >
              <span className="ps-spinner size-10 rounded-full border-4 border-white/20 border-t-edge" />
              <p className="font-bold text-[#c9cfd8]">{text.stage.loading}</p>
            </div>
          )}
          {status === "error" && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-canvas p-6 text-center"
              data-no-brake
              role="alert"
              data-testid="game-error"
            >
              <p className="text-xl font-extrabold">{text.stage.errorTitle}</p>
              <p className="text-[#c9cfd8]">{text.stage.errorBody}</p>
              <button
                type="button"
                onClick={() => setAttempt((value) => value + 1)}
                className="press mt-2 min-h-12 cursor-pointer rounded-full bg-express px-8 text-lg font-bold text-white"
              >
                {text.stage.retry}
              </button>
            </div>
          )}
        </div>

        <section aria-label={text.stage.controls} className="ps-side ps-side-right rounded-2xl bg-[#1b2030] p-4 text-sm">
          <h2 className="text-lg font-extrabold">{text.stage.controls}</h2>
          <dl className="mt-2 flex flex-col gap-2">
            {[
              [text.stage.brakeKey, text.stage.brakeKeyValue],
              [text.stage.nextKey, "Enter"],
              [text.stage.pause, "P／Esc"],
              [text.stage.restart, "R"],
              [text.stage.fullscreen, "F"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="font-bold">{label}</dt>
                <dd className="text-right text-[#c9cfd8]">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 border-t border-[#2a3040] pt-3 leading-relaxed text-[#aab3c5]">
            {text.stage.backHint}
          </p>
        </section>

        <section aria-label={text.stage.route} className="ps-below flex-col gap-3 px-4 pb-4 pt-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-extrabold">{text.stage.route}</h2>
            <span className="text-sm font-extrabold tabular-nums text-edge">
              {fmt(text.stage.points, { score: formatNumber(snapshot.total, locale) })}
              {multiplierNow && multiplierNow > 1 ? ` · ×${multiplierNow.toFixed(1)}` : ""}
            </span>
          </div>
          <div className="rounded-2xl bg-sign-deep px-1.5 pb-2.5 pt-3">
            <RouteStrip
              route={route}
              current={snapshot.phase === "final" ? 5 : snapshot.index}
              detailed={false}
              text={text}
              locale={locale}
            />
          </div>
          <p className="text-center text-xs leading-relaxed text-[#aab3c5]">{text.stage.touchHint}</p>
        </section>
      </div>

      {sharing && outcome && route && (
        <SharePanel
          text={text}
          locale={locale}
          route={route}
          results={snapshot.results}
          total={snapshot.total}
          newRecord={outcome.isNewRecord}
          dateKey={route.dateKey ?? taiwanDateKey()}
          onClose={() => setSharing(false)}
        />
      )}
    </div>
  );

  // 掛到 body 底下，蓋住整個網站（頁首、說明、廣告都由 CSS 隱藏）
  return mounted ? createPortal(stage, document.body) : null;
}

