import { FX, PHYSICS, msToKmh } from "./config";
import { autopilotDecision } from "./autopilot";
import { createTrainState, stepTrain, type TrainState } from "./physics";
import type { Route, RouteStop } from "./route";
import { scoreStop, totalScore, type StopResult } from "./scoring";

/**
 * 一局遊戲的流程控制。純邏輯，不碰畫面：
 * briefing（站點介紹）→ running（行駛）→ judged（判定）→ 下一站……→ final（結算）
 *
 * 畫面層（Phaser 場景與 React 介面）只讀取 snapshot 並呼叫這裡的方法。
 */
export type Phase = "briefing" | "running" | "judged" | "final";

export type SessionEvent =
  | { type: "depart"; index: number }
  | { type: "zoom"; index: number }
  | { type: "stopped"; index: number }
  | { type: "judged"; index: number; result: StopResult }
  | { type: "final"; total: number }
  | { type: "restart" };

export type Snapshot = {
  phase: Phase;
  paused: boolean;
  /** 目前是第幾站（0 起算） */
  index: number;
  stop: RouteStop;
  train: TrainState;
  speedKmh: number;
  /** 玩家是否按著煞車 */
  braking: boolean;
  /** 進這一站之前的連擊站數 */
  streak: number;
  /** 已經完成的各站結果 */
  results: StopResult[];
  total: number;
  /** 已進入近站放大（剩 5 m 內） */
  zoomed: boolean;
};

type Listener = () => void;
type EventListener = (event: SessionEvent) => void;

export class GameSession {
  readonly route: Route;
  /** 測試用：開啟後由自動駕駛操作煞車 */
  autopilot = false;
  /** 測試用：時間倍率 */
  timeScale = 1;

  private phase: Phase = "briefing";
  private paused = false;
  private index = 0;
  private train: TrainState;
  private braking = false;
  private streak = 0;
  private results: StopResult[] = [];
  private zoomed = false;
  private stoppedEmitted = false;
  private accumulator = 0;
  private snapshot: Snapshot;
  private listeners = new Set<Listener>();
  private eventListeners = new Set<EventListener>();

  constructor(route: Route) {
    this.route = route;
    this.train = createTrainState(route.stops[0]);
    this.snapshot = this.buildSnapshot();
  }

  // ---- 訂閱 ----
  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  onEvent(listener: EventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  getSnapshot = (): Snapshot => this.snapshot;

  // ---- 操作 ----
  /** 站點介紹 → 出發 */
  depart(): void {
    if (this.phase !== "briefing" || this.paused) return;
    this.phase = "running";
    this.emit({ type: "depart", index: this.index });
    this.commit();
  }

  /** 判定 → 下一站；最後一站 → 結算 */
  next(): void {
    if (this.phase !== "judged" || this.paused) return;
    if (this.index >= this.route.stops.length - 1) {
      this.phase = "final";
      this.emit({ type: "final", total: totalScore(this.results) });
    } else {
      this.index += 1;
      this.phase = "briefing";
      this.resetTrain();
    }
    this.commit();
  }

  /** Enter 鍵：依目前階段出發或前往下一站 */
  advance(): void {
    if (this.phase === "briefing") this.depart();
    else if (this.phase === "judged") this.next();
  }

  setBrake(held: boolean): void {
    if (this.braking === held) return;
    this.braking = held;
    this.commit();
  }

  pause(): void {
    if (this.paused || this.phase === "final") return;
    this.paused = true;
    this.braking = false;
    this.commit();
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    // 繼續時煞車力歸零，避免手指一放回去就誤煞
    this.braking = false;
    this.train.brake = 0;
    this.accumulator = 0;
    this.commit();
  }

  togglePause(): void {
    if (this.paused) this.resume();
    else this.pause();
  }

  /** 同一條路線從第 1 站重來 */
  restart(): void {
    this.phase = "briefing";
    this.paused = false;
    this.index = 0;
    this.streak = 0;
    this.results = [];
    this.resetTrain();
    this.emit({ type: "restart" });
    this.commit();
  }

  /** 每個畫面更新呼叫一次，dt 是秒 */
  update(dt: number): void {
    if (this.paused || this.phase !== "running") return;
    // 分頁切回來時 dt 可能很大，最多補 0.25 秒
    this.accumulator += Math.min(dt, 0.25) * this.timeScale;
    const stop = this.route.stops[this.index];
    let stepped = false;
    while (this.accumulator >= PHYSICS.step && this.phase === "running") {
      this.accumulator -= PHYSICS.step;
      const held = this.autopilot ? autopilotDecision(this.train, stop) : this.braking;
      stepTrain(this.train, held, stop);
      stepped = true;

      if (!this.zoomed && this.train.distance <= FX.zoomAt) {
        this.zoomed = true;
        this.emit({ type: "zoom", index: this.index });
      }
      if (this.train.speed === 0 && !this.stoppedEmitted) {
        this.stoppedEmitted = true;
        this.emit({ type: "stopped", index: this.index });
      } else if (this.train.speed > 0) {
        this.stoppedEmitted = false;
      }
      if (this.train.settled) this.judgeStop();
    }
    if (stepped) this.commit();
  }

  // ---- 內部 ----
  private judgeStop(): void {
    const stop = this.route.stops[this.index];
    const result = scoreStop(
      {
        // 誤差量到公釐為止，分享連結解碼後才能算出一模一樣的分數
        error: Math.round(-this.train.distance * 1000) / 1000,
        elapsed: this.train.elapsed,
        target: stop.targetTime,
        emergency: this.train.emergency,
      },
      this.streak,
    );
    this.results = [...this.results, result];
    this.streak = result.streak;
    this.phase = "judged";
    this.braking = false;
    this.emit({ type: "judged", index: this.index, result });
  }

  private resetTrain(): void {
    this.train = createTrainState(this.route.stops[this.index]);
    this.braking = false;
    this.zoomed = false;
    this.stoppedEmitted = false;
    this.accumulator = 0;
  }

  private buildSnapshot(): Snapshot {
    const judged = this.phase === "judged" || this.phase === "final";
    return {
      phase: this.phase,
      paused: this.paused,
      index: this.index,
      stop: this.route.stops[this.index],
      train: { ...this.train },
      speedKmh: msToKmh(this.train.speed),
      braking: this.braking,
      // 判定畫面顯示的是「進這一站之前」的連擊，結果已經收在 results 裡
      streak: judged ? (this.results.at(-2)?.streak ?? 0) : this.streak,
      results: this.results,
      total: totalScore(this.results),
      zoomed: this.zoomed,
    };
  }

  private commit(): void {
    this.snapshot = this.buildSnapshot();
    for (const listener of this.listeners) listener();
  }

  private emit(event: SessionEvent): void {
    for (const listener of this.eventListeners) listener(event);
  }
}
