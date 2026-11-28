import { autopilotHold } from "./autopilot";
import { CAMERA, DRAW, ENDING, FLOORS, STEP, TEMP } from "./config";
import type { Layout, Vec2 } from "./layouts";
import { buildPath, type Path } from "./path";
import { displayTemp, gradeOf, scoreOf, temperatureAt, tempBand, type Grade, type TempBand } from "./scoring";
import { createFloorSim, drainWalkEvents, stepFloor, tilt, type FloorSim, type WalkEvent } from "./sim";
import { idealLine } from "./solver";
import { randomSeed, towerFor, type Mode, type Tower } from "./tower";

/**
 * 一局的流程（F1）：
 *   intro（鏡頭升到這一層、層數牌）→ draw（畫線）→ ready（畫好待走，可以重畫）→ walk（按住走、放開停）
 *   → 走到樓梯口：下一層的 intro … 第 5 層走完 → summit（塔頂動畫）→ over（結算）
 *   摔下去 → falling（慢動作 0.6 秒）→ over；湯灑光 → spilled → over
 * 另外有 paused（記住暫停前的階段）。
 *
 * 時間（C1、C9）只在 draw、ready、walk 這三個階段累積，暫停、過層動畫、結局動畫都不算。
 * 模擬是 60 Hz 固定步進；session 負責把真實時間換成步數，以及開發用的自動駕駛與加速。
 * 純邏輯，不碰 DOM 與真實時間。
 */
export type Phase = "intro" | "draw" | "ready" | "walk" | "summit" | "falling" | "spilled" | "paused" | "over";
export type Outcome = "summit" | "fall" | "empty";
export type LineCheck = "ok" | "start" | "goal" | "short";

export type RunResult = {
  mode: Mode;
  seed: number | null;
  outcome: Outcome;
  /** 到第幾層（送達塔頂是 5） */
  floor: number;
  /** 剩下的湯（千分比，整數） */
  soup: number;
  timeMs: number;
  /** 送到時的溫度（1 位小數） */
  temp: number;
  band: TempBand;
  /** 失敗時沒有分數（C8） */
  score: number | null;
  grade: Grade | null;
};

export type SessionEvent =
  | WalkEvent
  | { type: "floor"; floor: number }
  | { type: "cold" }
  | { type: "summit" }
  | { type: "over"; result: RunResult };

export type Snapshot = {
  phase: Phase;
  /** 暫停時：暫停前的階段 */
  resumePhase: Phase | null;
  /** 第幾層（1～5） */
  floor: number;
  soup: number;
  temp: number;
  cold: boolean;
  /** 湯面傾斜（給 HUD 的碗） */
  lat: number;
  lon: number;
  tilt: number;
  holding: boolean;
  hasLine: boolean;
  timeMs: number;
  result: RunResult | null;
};

const MAX_FRAME_SECONDS = 0.1;
const AUTO_DRAW_SECONDS = 0.8;

export class MonkSession {
  tower: Tower;
  phase: Phase = "intro";
  resumePhase: Phase | null = null;
  /** 第幾層（0 起算） */
  index = 0;
  /** 剩下的湯（千分比，浮點數；結算時取整數） */
  soup = 1000;
  /** 計時的步數（只算 draw、ready、walk） */
  ticks = 0;
  path: Path | null = null;
  sim: FloorSim | null = null;
  holding = false;
  result: RunResult | null = null;
  /** 開發用：自動駕駛、時間倍率 */
  autopilot = false;
  timeScale = 1;
  /** 這一層的 intro 還剩幾秒 */
  introLeft: number;
  /** 結局動畫還剩幾秒 */
  endingLeft = 0;
  private acc = 0;
  private autoDraw = 0;
  private pending: SessionEvent[] = [];
  private wasCold = false;
  /** 還沒套用的按放（一格畫面裡可能按了又放）：每一步套用一個，短按不會被吃掉（B16，Codex 審查第 2 輪） */
  private inputs: boolean[] = [];
  /** 模擬目前用的按放狀態 */
  private applied = false;

  constructor(
    readonly mode: Mode = "fixed",
    seed: number | null = null,
    private reduced = false,
    private readonly seedOf: () => number = randomSeed,
  ) {
    this.tower = towerFor(mode, mode === "random" ? (seed ?? seedOf()) : null);
    this.introLeft = this.introSeconds();
    this.pending.push({ type: "floor", floor: 1 });
  }

  get layout(): Layout {
    return this.tower.floors[this.index]!;
  }

  get floor(): number {
    return this.index + 1;
  }

  get timeMs(): number {
    return Math.round((this.ticks * 1000) / 60);
  }

  get temperature(): number {
    return temperatureAt(this.timeMs);
  }

  /** 遊戲中途切換「減少動態效果」：之後的過層與結局動畫照新的設定（G6） */
  setReduced(reduced: boolean) {
    this.reduced = reduced;
    // 已經開始的過層與結局動畫也跟著縮短（Codex 審查第 3 輪）
    if (reduced) {
      this.introLeft = Math.min(this.introLeft, CAMERA.climbReducedSeconds);
      this.endingLeft = 0;
    }
  }

  private introSeconds() {
    return this.reduced ? CAMERA.climbReducedSeconds : CAMERA.climbSeconds;
  }

  /** 重新開始：同一種模式。隨機模式換一座新塔，除非 sameTower（結算的「再爬一次」挑戰同一座塔時） */
  restart(sameTower = false) {
    const seed = this.mode === "random" ? (sameTower ? this.tower.seed : this.seedOf()) : null;
    this.tower = towerFor(this.mode, seed);
    this.phase = "intro";
    this.resumePhase = null;
    this.index = 0;
    this.soup = 1000;
    this.ticks = 0;
    this.path = null;
    this.sim = null;
    this.holding = false;
    this.inputs = [];
    this.applied = false;
    this.result = null;
    this.introLeft = this.introSeconds();
    this.endingLeft = 0;
    this.acc = 0;
    this.autoDraw = 0;
    this.wasCold = false;
    this.pending = [{ type: "floor", floor: 1 }];
  }

  // ---- 畫線（B1–B4） ----

  /** 按下的這一點能不能開始畫：要在和尚腳下 0.9 單位內，而且還沒開始走 */
  canStartAt(p: Vec2): boolean {
    if (this.phase !== "draw" && this.phase !== "ready") return false;
    const s = this.layout.start;
    return Math.hypot(p.x - s.x, p.z - s.z) <= DRAW.startRadius;
  }

  /** 終點在不在樓梯口的金色圓圈裡 */
  reachesGoal(p: Vec2): boolean {
    const g = this.layout.goal;
    return Math.hypot(p.x - g.x, p.z - g.z) <= DRAW.goalRadius;
  }

  /** 開始畫新的一條線：舊的線清掉 */
  beginLine() {
    if (this.phase !== "draw" && this.phase !== "ready") return;
    this.path = null;
    this.sim = null;
    this.phase = "draw";
  }

  /**
   * 放開手指：檢查這條線。起點不在和尚腳下（start）、終點沒進樓梯口（goal）、太短（short）都清掉線。
   * 通過的線從和尚的位置開始（起點換成和尚腳下），平滑後就可以走了。
   */
  setLine(raw: Vec2[]): LineCheck {
    if (this.phase !== "draw" && this.phase !== "ready") return "short";
    const first = raw[0];
    const last = raw[raw.length - 1];
    let check: LineCheck = "ok";
    if (!first || !last || raw.length < 2) check = "short";
    else if (!this.canStartAt(first)) check = "start";
    else if (!this.reachesGoal(last)) check = "goal";
    if (check !== "ok") {
      this.path = null;
      this.sim = null;
      this.phase = "draw";
      return check;
    }
    const points = [{ ...this.layout.start }, ...raw.slice(0, DRAW.maxRawPoints)];
    this.path = buildPath(points);
    this.sim = createFloorSim(this.layout, this.path, this.soup);
    this.phase = "ready";
    return "ok";
  }

  /** 重畫（R 鍵、重畫鈕）：只有還沒開始走的時候可以（B4） */
  redraw(): boolean {
    if (this.phase !== "ready") return false;
    this.path = null;
    this.sim = null;
    this.phase = "draw";
    return true;
  }

  /** 按住或放開（E3）。畫好線之後第一次按住就開始走，之後不能重畫 */
  setHolding(holding: boolean) {
    if (holding !== this.holding && (this.phase === "ready" || this.phase === "walk")) this.inputs.push(holding);
    this.holding = holding;
    if (holding && this.phase === "ready" && this.sim) this.phase = "walk";
  }

  get canRedraw() {
    return this.phase === "ready";
  }

  // ---- 暫停（B17、E6） ----

  pause() {
    if (this.phase === "paused" || this.phase === "over") return;
    this.resumePhase = this.phase;
    this.phase = "paused";
    this.holding = false;
    this.inputs = [];
    this.applied = false;
  }

  resume() {
    if (this.phase !== "paused" || !this.resumePhase) return;
    this.phase = this.resumePhase;
    this.resumePhase = null;
  }

  // ---- 時間 ----

  /** 前進 deltaMs 毫秒（真實時間），回傳這段期間的事件 */
  update(deltaMs: number): SessionEvent[] {
    const delta = Math.min(MAX_FRAME_SECONDS, Math.max(0, deltaMs / 1000)) * this.timeScale;
    if (this.phase !== "paused" && this.phase !== "over") {
      this.acc += delta;
      let guard = 0;
      while (this.acc >= STEP && guard++ < 20000) {
        this.acc -= STEP;
        this.tick();
        // tick 可能讓這一局結束（over）：之後的時間不再前進
        if ((this.phase as Phase) === "over") break;
      }
    }
    const events = this.pending;
    this.pending = [];
    return events;
  }

  /** 前進一步（1/60 秒） */
  private tick() {
    switch (this.phase) {
      case "intro":
        this.introLeft -= STEP;
        if (this.introLeft <= 0) this.phase = "draw";
        return;
      case "draw":
      case "ready":
        this.clock();
        if (this.autopilot) this.autoplayDraw();
        return;
      case "walk":
        this.clock();
        this.walk();
        return;
      case "summit":
      case "falling":
      case "spilled":
        this.endingLeft -= STEP;
        if (this.endingLeft <= 0) this.finish();
        return;
      default:
        return;
    }
  }

  private clock() {
    this.ticks += 1;
    const cold = this.temperature < TEMP.cold;
    if (cold && !this.wasCold) this.pending.push({ type: "cold" });
    this.wasCold = cold;
  }

  private autoplayDraw() {
    if (this.phase === "draw") {
      this.autoDraw += STEP;
      if (this.autoDraw < AUTO_DRAW_SECONDS) return;
      this.autoDraw = 0;
      const line = idealLine(this.layout);
      if (line) this.setLine(line);
      return;
    }
    if (this.phase === "ready") this.setHolding(true);
  }

  private walk() {
    const sim = this.sim;
    if (!sim) return;
    if (this.inputs.length > 0) this.applied = this.inputs.shift()!;
    const hold = this.autopilot ? autopilotHold(sim, this.holding) : this.applied;
    if (this.autopilot) {
      this.holding = hold;
      this.applied = hold;
    }
    stepFloor(sim, hold);
    this.soup = sim.soup;
    this.pending.push(...drainWalkEvents(sim));
    if (sim.done === "fall") {
      this.phase = "falling";
      this.endingLeft = this.reduced ? 0 : ENDING.fallSeconds;
      this.outcome = "fall";
    } else if (sim.done === "empty") {
      this.phase = "spilled";
      this.endingLeft = this.reduced ? 0 : ENDING.emptySeconds;
      this.outcome = "empty";
    } else if (sim.done === "arrive") {
      this.holding = false;
      this.inputs = [];
      this.applied = false;
      if (this.index === FLOORS - 1) {
        this.phase = "summit";
        this.endingLeft = this.reduced ? 0 : ENDING.summitSeconds;
        this.outcome = "summit";
        this.pending.push({ type: "summit" });
      } else {
        this.index += 1;
        this.path = null;
        this.sim = null;
        this.phase = "intro";
        this.introLeft = this.introSeconds();
        this.pending.push({ type: "floor", floor: this.floor });
      }
    }
  }

  private outcome: Outcome = "summit";

  /** 結算（結局動畫結束時；測試也可以直接呼叫跳過動畫） */
  finish() {
    if (this.phase !== "summit" && this.phase !== "falling" && this.phase !== "spilled") return;
    const timeMs = this.timeMs;
    const soup = Math.max(0, Math.round(this.soup));
    const success = this.outcome === "summit";
    const score = success ? scoreOf(soup, timeMs) : null;
    this.result = {
      mode: this.mode,
      seed: this.tower.seed,
      outcome: this.outcome,
      floor: this.floor,
      soup: this.outcome === "empty" ? 0 : soup,
      timeMs,
      temp: displayTemp(timeMs),
      band: tempBand(temperatureAt(timeMs)),
      score,
      grade: score === null ? null : gradeOf(score),
    };
    this.phase = "over";
    this.pending.push({ type: "over", result: this.result });
  }

  snapshot(): Snapshot {
    const sim = this.sim;
    const soup = Math.max(0, this.soup);
    return {
      phase: this.phase,
      resumePhase: this.resumePhase,
      floor: this.floor,
      soup,
      temp: displayTemp(this.timeMs),
      cold: this.temperature < TEMP.cold,
      lat: sim?.lat ?? 0,
      lon: sim?.lon ?? 0,
      tilt: sim ? tilt(sim) : 0,
      holding: this.holding,
      hasLine: this.path !== null,
      timeMs: this.timeMs,
      result: this.result,
    };
  }
}
