import { autopilotAxis } from "./autopilot";
import { FIELD, OVER_DELAY_SECONDS, PLAYER, STEP } from "./config";
import { ceilingY, clampView, createSim, depthOf, drainEvents, randomSeed, step, totalScore, type OverReason, type Sim, type SimEvent } from "./sim";

/**
 * 一局的流程（F 組）：準備 → 進行 → 暫停 → 失敗動畫（dying）→ 結算。
 * 包住模擬（sim.ts），負責固定步長的累積、暫停、自動駕駛與開發用的加速。純邏輯，不碰 DOM 與時間。
 */
export type Phase = "ready" | "playing" | "paused" | "dying" | "over";

export type RunResult = {
  seed: number;
  depth: number;
  total: number;
  parts: { depth: number; graze: number; crystal: number };
  reason: OverReason;
  grazes: number;
  hits: number;
  seconds: number;
};

export type Snapshot = {
  phase: Phase;
  depth: number;
  score: number;
  hp: number;
  mult: number;
  multTimer: number;
  scene: number;
  /** 頭到崩塌線的距離（公尺）；小於 1.2 時畫面提示崩塌逼近 */
  headroom: number;
  result: RunResult | null;
};

/** 一次最多補這麼多秒（切回分頁時不要一口氣跑完整段） */
const MAX_FRAME_SECONDS = 0.1;

export class MineSession {
  sim: Sim;
  phase: Phase = "ready";
  axis: -1 | 0 | 1 = 0;
  /** 開發用：自動以最佳操作玩 */
  autopilot = false;
  /** 開發用：加速時間（測試不用等真實時長） */
  timeScale = 1;
  result: RunResult | null = null;
  private acc = 0;
  private dyingFor = 0;
  private pending: SimEvent[] = [];
  private view: number = FIELD.height;

  constructor(
    private readonly seedOf: () => number = randomSeed,
  ) {
    this.sim = createSim(this.seedOf());
  }

  /** 畫面看得到的高度（公尺）。遊戲框的長寬比決定；重新開始後仍沿用 */
  get viewHeight() {
    return this.view;
  }

  setViewHeight(height: number) {
    this.view = clampView(height);
    this.sim.viewHeight = this.view;
  }

  start() {
    if (this.phase === "ready") this.phase = "playing";
  }

  /** 重新開始：新的一局（自由模式每局隨機種子）直接進行中 */
  restart() {
    this.sim = createSim(this.seedOf(), this.view);
    this.axis = 0;
    this.acc = 0;
    this.dyingFor = 0;
    this.result = null;
    this.pending = [];
    this.phase = "playing";
  }

  pause() {
    if (this.phase === "playing") this.phase = "paused";
  }

  resume() {
    if (this.phase === "paused") this.phase = "playing";
  }

  setAxis(axis: -1 | 0 | 1) {
    this.axis = axis;
  }

  /** 前進 deltaMs 毫秒。回傳這段時間發生的事件 */
  update(deltaMs: number): SimEvent[] {
    const delta = Math.min(MAX_FRAME_SECONDS, Math.max(0, deltaMs / 1000));
    if (this.phase === "playing") {
      this.acc += delta * this.timeScale;
      let guard = 0;
      while (this.acc >= STEP && this.phase === "playing" && guard++ < 4000) {
        this.acc -= STEP;
        step(this.sim, this.autopilot ? autopilotAxis(this.sim) : this.axis);
        this.pending.push(...drainEvents(this.sim));
        if (this.sim.over) this.phase = "dying";
      }
    } else if (this.phase === "dying") {
      this.dyingFor += delta;
      if (this.dyingFor >= OVER_DELAY_SECONDS) this.finish();
    }
    const events = this.pending;
    this.pending = [];
    return events;
  }

  /** 結算（跳過失敗動畫時也用它） */
  finish() {
    if (this.phase !== "dying" && this.phase !== "playing") return;
    const sim = this.sim;
    this.result = {
      seed: sim.seed,
      depth: depthOf(sim),
      total: totalScore(sim),
      parts: { ...sim.parts },
      reason: sim.over ?? "hp",
      grazes: sim.grazes,
      hits: sim.hits,
      seconds: Math.round(sim.time * 10) / 10,
    };
    this.phase = "over";
  }

  snapshot(): Snapshot {
    const sim = this.sim;
    return {
      phase: this.phase,
      depth: depthOf(sim),
      score: totalScore(sim),
      hp: sim.player.hp,
      mult: sim.mult,
      multTimer: sim.multTimer,
      scene: sim.zone,
      headroom: sim.player.y - PLAYER.height - ceilingY(sim.scrolled),
      result: this.result,
    };
  }
}
