import { EVENT, SEGMENT_COUNT, STEP } from "./config";
import { applyAction, autopilotAction } from "./autopilot";
import { LAYOUT, rollRun, type Run } from "./route";
import { Sim, type SimEvent, type SimResult } from "./sim";

/**
 * 一局遊戲的流程控制。純邏輯，不碰畫面：
 * briefing（段落介紹）→ running（奔跑，含突發事件）→ briefing（下一段）……→ finishing（衝出大門歡呼）→ final（結算）
 * 被主管攔下時從 running 直接進 final。畫面層只讀 snapshot 並呼叫這裡的方法。
 */
export type Phase = "briefing" | "running" | "finishing" | "final";

export type SessionEvent = SimEvent | { type: "depart"; segment: number } | { type: "restart" } | { type: "final"; result: SimResult };

export type Snapshot = {
  phase: Phase;
  paused: boolean;
  segment: number;
  /** 模擬的狀態，畫面每一格讀取 */
  tick: number;
  z: number;
  x: number;
  speed: number;
  jump: number;
  stun: "held" | "trip" | "door" | "gaze" | null;
  coffee: boolean;
  headphones: boolean;
  dnd: boolean;
  streak: number;
  score: number;
  /** 突發事件：還剩幾秒（真實時間）；沒有事件時是 null */
  eventLeft: number | null;
  event: { pool: string; line: number; order: [number, number, number] } | null;
  result: SimResult | null;
};

type Listener = () => void;
type EventListener = (event: SessionEvent) => void;

/** 衝出大門歡呼多久之後進結算（秒） */
export const FINISHING_SECONDS = 1.6;
/** 暫停後繼續的緩衝（秒） */
export const RESUME_SECONDS = 1;

export class GameSession {
  readonly run: Run;
  sim: Sim;
  /** 測試用：自動駕駛 */
  autopilot = false;
  /** 測試用：時間倍率 */
  timeScale = 1;
  /** 減少動態效果：事件不放慢（G6）。只改呈現，模擬仍然一樣，限時照算 */
  reduceMotion = false;

  private phase: Phase = "briefing";
  private paused = false;
  private accumulator = 0;
  private eventElapsed = 0;
  /** 暫停後繼續：這麼多秒內世界先不前進，玩家來得及把手放回去（E4） */
  private resumeDelay = 0;
  private finishingLeft = 0;
  private snapshot: Snapshot;
  private listeners = new Set<Listener>();
  private eventListeners = new Set<EventListener>();

  constructor(seed: number) {
    this.run = rollRun(seed);
    this.sim = new Sim(this.run);
    this.snapshot = this.build();
  }

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
  depart() {
    if (this.phase !== "briefing" || this.paused) return;
    this.phase = "running";
    this.accumulator = 0;
    this.emit({ type: "depart", segment: this.sim.segment });
    this.commit();
  }

  /** Enter／空白鍵：段落介紹時出發 */
  advance() {
    if (this.phase === "briefing") this.depart();
  }

  moveLane(direction: -1 | 1) {
    if (this.phase !== "running" || this.paused) return;
    this.sim.moveLane(direction);
    this.flush();
  }
  jump() {
    if (this.phase !== "running" || this.paused) return;
    this.sim.jump();
    this.flush();
  }
  /** 選突發事件的第 pos 個選項 */
  answer(pos: number) {
    if (this.phase !== "running" || this.paused || !this.sim.event) return;
    this.sim.answer(pos);
    this.eventElapsed = 0;
    this.flush();
  }

  pause() {
    if (this.paused || this.phase === "final") return;
    this.paused = true;
    this.commit();
  }
  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.accumulator = 0;
    this.resumeDelay = RESUME_SECONDS;
    this.commit();
  }
  togglePause() {
    if (this.paused) this.resume();
    else this.pause();
  }

  /** 同一個種子從頭再來（R、暫停選單的重新開始）；再玩一次由畫面層換新的種子建立新的 session */
  restart() {
    this.sim = new Sim(this.run);
    this.phase = "briefing";
    this.paused = false;
    this.accumulator = 0;
    this.eventElapsed = 0;
    this.finishingLeft = 0;
    this.emit({ type: "restart" });
    this.commit();
  }

  /** 每個畫面更新呼叫一次，dt 是秒 */
  update(dt: number) {
    if (this.paused) return;
    if (this.phase === "finishing") {
      this.finishingLeft -= Math.min(dt, 0.25) * this.timeScale;
      if (this.finishingLeft <= 0) this.toFinal();
      return;
    }
    if (this.phase !== "running") return;
    // 分頁切回來時 dt 可能很大，最多補 0.25 秒
    const real = Math.min(dt, 0.25) * this.timeScale;
    if (this.resumeDelay > 0) {
      this.resumeDelay -= real;
      return;
    }
    const eventActive = this.sim.event !== null;
    if (eventActive) {
      this.eventElapsed += real;
      if (this.eventElapsed >= EVENT.limitSeconds) {
        // 超時算選錯（B11）
        this.sim.answer(null);
        this.eventElapsed = 0;
        this.flush();
      }
    }
    // 事件期間世界放慢到 20%；減少動態效果時不放慢（G6），限時仍然照算
    this.accumulator += real * (eventActive && !this.reduceMotion ? EVENT.slowFactor : 1);
    while (this.accumulator >= STEP && this.phase === "running") {
      this.accumulator -= STEP;
      if (this.autopilot) applyAction(this.sim, autopilotAction(this.sim));
      this.sim.step();
      this.flush();
      if (this.sim.event && !eventActive) this.eventElapsed = 0;
    }
    this.commit();
  }

  // ---- 內部 ----
  private flush() {
    const events = this.sim.drain();
    for (const event of events) {
      this.emit(event);
      if (event.type === "segment" && event.index < SEGMENT_COUNT - 1) {
        // 一段結束：下一段的介紹
        this.phase = "briefing";
        this.accumulator = 0;
      } else if (event.type === "finish") {
        this.phase = "finishing";
        this.finishingLeft = FINISHING_SECONDS;
      } else if (event.type === "caught") {
        this.toFinal();
      }
    }
    if (events.length > 0) this.commit();
  }

  private toFinal() {
    if (this.phase === "final") return;
    this.phase = "final";
    const result = this.sim.result;
    if (result) this.emit({ type: "final", result });
    this.commit();
  }

  private build(): Snapshot {
    const sim = this.sim;
    const event = sim.event;
    return {
      phase: this.phase,
      paused: this.paused,
      segment: sim.segment,
      tick: sim.tick,
      z: sim.z,
      x: sim.x,
      speed: sim.speed,
      jump: sim.jumpProgress,
      stun: sim.stun?.kind ?? null,
      coffee: sim.coffeeLeft > 0,
      headphones: sim.headphonesLeft > 0,
      dnd: sim.dnd,
      streak: sim.grazeStreak,
      score: sim.parts.time + sim.parts.graze + sim.parts.event + sim.parts.item,
      eventLeft: event ? Math.max(0, EVENT.limitSeconds - this.eventElapsed) : null,
      event: event ? { pool: event.pool, line: event.dialogue.line, order: event.dialogue.order } : null,
      result: sim.result,
    };
  }

  private commit() {
    this.snapshot = this.build();
    for (const listener of this.listeners) listener();
  }

  private emit(event: SessionEvent) {
    for (const listener of this.eventListeners) listener(event);
  }
}

export { LAYOUT };
