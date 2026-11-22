import { CLOCK, DELAY, HIT, LANES, MOVE, SCORE, SEGMENT_COUNT, SEGMENTS, STEP, TICKS_PER_SECOND, type Lane } from "./config";
import {
  GAZE_LENGTH,
  JUMPABLE,
  LAYOUT,
  gazeLane,
  openDoorLane,
  type Dialogue,
  type LinePool,
  type Run,
} from "./route";
import { endingFor, eventPoints, grazePoints, secondsShort, timeScore, totalScore, type Ending, type ScoreParts } from "./scoring";

/**
 * 一局的模擬（固定 1/120 秒步長）。純邏輯：同一個種子加上同樣的操作序列，結果完全相同（B4）。
 * 時鐘用步長數（整數）計算，邊界判斷沒有浮點誤差。
 */
export type Stun = { kind: "held" | "trip" | "door" | "gaze"; left: number };
export type PendingEvent = { pool: LinePool; dialogue: Dialogue; segment: number };

export type SimEvent =
  | { type: "lane"; to: Lane }
  | { type: "jump" }
  | { type: "land" }
  | { type: "graze"; streak: number; points: number }
  | { type: "hit"; kind: "held" | "trip"; id: number }
  | { type: "door"; passed: boolean; lane: Lane }
  | { type: "gaze" }
  | { type: "pickup"; item: "coffee" | "headphones" | "dnd"; id: number }
  | { type: "blocked"; by: "dnd" | "headphones" }
  | { type: "event"; event: PendingEvent }
  | { type: "answer"; grade: number; points: number }
  | { type: "segment"; index: number; time: number; timeScore: number }
  | { type: "reader" }
  | { type: "finish"; ending: Ending }
  | { type: "caught"; secondsShort: number };

const JUMP_TICKS = Math.round(MOVE.jumpSeconds * TICKS_PER_SECOND);
const LANE_TICKS = Math.round(MOVE.laneSeconds * TICKS_PER_SECOND);
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
const HIT_DX = round6(HIT.player + HIT.obstacle);
const GRAZE_DX = round6(HIT_DX + HIT.graze);
const sec = (n: number) => Math.round(n * TICKS_PER_SECOND);
/** 橫向距離（線寬單位），取到 6 位小數：邊界值（剛好 0.3）不被浮點誤差影響（C2） */
const lateral = (lane: number, x: number) => Math.round(Math.abs(lane - x) * 1e6) / 1e6;

export type SimResult = {
  ending: Ending;
  hidden: boolean;
  clockTicks: number;
  parts: ScoreParts;
  total: number;
  /** 各段用時（步長數） */
  segmentTicks: number[];
  /** 被攔下時，差幾秒就衝出大門；其他結局是 null */
  secondsShort: number | null;
  grazes: number;
};

export class Sim {
  readonly run: Run;
  /** 時鐘步長數（18:00:00 起，含被耽誤跳走的時間） */
  tick = 0;
  z = 0;
  segment = 0;
  lane: Lane = 0;
  /** 連續的橫向位置（線寬單位），換線中介於兩條線之間 */
  x = 0;
  private laneFrom = 0;
  private laneLeft = 0;
  /** 0 表示沒在跳；1..JUMP_TICKS 是跳躍進度 */
  jumpTick = 0;
  stun: Stun | null = null;
  coffeeLeft = 0;
  headphonesLeft = 0;
  dnd = false;
  grazeStreak = 0;
  grazes = 0;
  parts: ScoreParts = { time: 0, graze: 0, event: 0, item: 0 };
  segmentTicks: number[] = [];
  segmentStartTick = 0;
  event: PendingEvent | null = null;
  finished = false;
  caught = false;
  calledByBoss = false;
  heldByColleague = false;
  result: SimResult | null = null;
  /** 這一局已經看過的台詞（"pool:line"），結算顯示「新看到幾句」 */
  readonly seen: string[] = [];
  private consumed = new Set<number>();
  private eventUsed: boolean[] = Array.from({ length: SEGMENT_COUNT }, () => false);
  private out: SimEvent[] = [];

  constructor(run: Run) {
    this.run = run;
  }

  /** 取走這幾步累積的事件 */
  drain(): SimEvent[] {
    const events = this.out;
    this.out = [];
    return events;
  }

  get clockSeconds() {
    return this.tick / TICKS_PER_SECOND;
  }
  get speed() {
    return LAYOUT.segments[this.segment].speed * (this.coffeeLeft > 0 ? MOVE.coffeeFactor : 1);
  }
  /** 這一步前進的公尺數；被耽誤或事件之外一律照速度 */
  get airborne() {
    return this.jumpTick > JUMP_TICKS * MOVE.airFrom && this.jumpTick < JUMP_TICKS * MOVE.airTo;
  }
  get jumpProgress() {
    return this.jumpTick === 0 ? 0 : this.jumpTick / JUMP_TICKS;
  }
  get over() {
    return this.finished || this.caught;
  }

  // ---- 操作 ----
  /** 往左（-1）或右（1）換一條線；跳躍中、被耽誤時不能換（B2、B3） */
  moveLane(direction: -1 | 1) {
    if (this.over || this.stun || this.jumpTick > 0) return;
    const target = Math.max(-1, Math.min(1, this.lane + direction)) as Lane;
    if (target === this.lane) return;
    this.laneFrom = this.x;
    this.lane = target;
    this.laneLeft = LANE_TICKS;
    this.out.push({ type: "lane", to: target });
  }

  jump() {
    if (this.over || this.stun || this.jumpTick > 0 || this.laneLeft > 0) return;
    this.jumpTick = 1;
    this.out.push({ type: "jump" });
  }

  /** 選了突發事件的第 pos 個選項（畫面上的順序），超時傳 null */
  answer(pos: number | null) {
    const pending = this.event;
    if (!pending) return;
    const grade = pos === null ? 2 : pending.dialogue.order[pos];
    const points = eventPoints(grade);
    this.parts.event += points;
    // 選錯：時鐘再往前跳 5 秒（B12）
    if (grade === 2) this.tick += sec(DELAY.wrongAnswerJump);
    this.event = null;
    this.out.push({ type: "answer", grade, points });
    this.checkCaught();
  }

  // ---- 前進一步 ----
  step() {
    if (this.over) return;
    this.tick += 1;
    if (this.coffeeLeft > 0) this.coffeeLeft -= 1;
    if (this.headphonesLeft > 0) this.headphonesLeft -= 1;
    if (this.checkCaught()) return;

    if (this.jumpTick > 0) {
      this.jumpTick += 1;
      if (this.jumpTick > JUMP_TICKS) {
        this.jumpTick = 0;
        this.out.push({ type: "land" });
      }
    }
    if (this.laneLeft > 0) {
      this.laneLeft -= 1;
      const k = 1 - this.laneLeft / LANE_TICKS;
      this.x = this.laneFrom + (this.lane - this.laneFrom) * k;
      if (this.laneLeft === 0) this.x = this.lane;
    }
    if (this.stun) {
      this.stun.left -= 1;
      if (this.stun.left <= 0) this.stun = null;
      return;
    }

    const from = this.z;
    const to = from + this.speed * STEP;
    this.z = to;
    this.cross(from, to);
    this.checkGaze();
    this.checkSegmentEnd();
  }

  private checkCaught(): boolean {
    if (this.over || this.tick <= CLOCK.callAt * TICKS_PER_SECOND) return false;
    this.caught = true;
    this.event = null;
    const remaining = LAYOUT.total - this.z;
    const short = secondsShort(remaining, LAYOUT.segments[this.segment].speed);
    this.out.push({ type: "caught", secondsShort: short });
    this.result = this.makeResult("overtime", short);
    return true;
  }

  private startStun(kind: Stun["kind"], seconds: number) {
    this.stun = { kind, left: sec(seconds) };
    this.grazeStreak = 0;
    this.jumpTick = 0;
    this.laneLeft = 0;
    this.x = this.lane;
  }

  private cross(from: number, to: number) {
    for (const o of LAYOUT.obstacles) {
      if (o.segment !== this.segment || this.consumed.has(o.id) || o.z <= from || o.z > to) continue;
      this.consumed.add(o.id);
      const dx = lateral(o.lane, this.x);
      const cleared = this.airborne && JUMPABLE.has(o.kind);
      if (dx < HIT_DX && !cleared) {
        if (o.kind === "chatter") {
          if (this.headphonesLeft > 0) {
            this.out.push({ type: "blocked", by: "headphones" });
          } else {
            this.heldByColleague = true;
            this.out.push({ type: "hit", kind: "held", id: o.id });
            this.startStun("held", DELAY.held);
          }
        } else {
          this.out.push({ type: "hit", kind: "trip", id: o.id });
          this.startStun("trip", DELAY.trip);
        }
        this.z = Math.min(this.z, o.z);
        return;
      }
      // 擦身：沒撞到，但橫向距離小於 0.3 個線寬（C2）；整個越過障礙（跳過）不算
      if (!cleared && dx >= HIT_DX && dx < GRAZE_DX) {
        this.grazeStreak += 1;
        this.grazes += 1;
        const points = grazePoints(this.grazeStreak);
        this.parts.graze += points;
        this.out.push({ type: "graze", streak: this.grazeStreak, points });
      }
    }
    for (const item of this.run.items) {
      if (item.segment !== this.segment || this.consumed.has(item.id) || item.z <= from || item.z > to) continue;
      this.consumed.add(item.id);
      if (lateral(item.lane, this.x) >= HIT_DX) continue;
      this.parts.item += SCORE.item;
      if (item.kind === "coffee") this.coffeeLeft = sec(MOVE.coffeeSeconds);
      else if (item.kind === "headphones") this.headphonesLeft = sec(MOVE.headphonesSeconds);
      else this.dnd = true;
      this.out.push({ type: "pickup", item: item.kind, id: item.id });
    }
    for (const door of LAYOUT.doors) {
      if (door.segment !== this.segment || this.consumed.has(door.id) || door.z <= from || door.z > to) continue;
      this.consumed.add(door.id);
      const lane = (Math.max(-1, Math.min(1, Math.round(this.x))) as Lane);
      const passed = openDoorLane(door, this.clockSeconds) === lane;
      this.out.push({ type: "door", passed, lane });
      if (!passed) {
        this.startStun("door", DELAY.door);
        this.z = Math.min(this.z, door.z);
        return;
      }
    }
    for (const spot of LAYOUT.events) {
      if (spot.segment !== this.segment || spot.z <= from || spot.z > to) continue;
      this.triggerEvent(spot.pool);
    }
    if (this.segment === SEGMENT_COUNT - 1 && LAYOUT.readerZ > from && LAYOUT.readerZ <= to) {
      this.out.push({ type: "reader" });
    }
  }

  /** 事件的觸發：勿擾模式擋掉（並算這一段已經觸發過）；同一段只出現一次（第 5 題） */
  private triggerEvent(pool: LinePool): boolean {
    if (this.event || this.eventUsed[this.segment]) return false;
    this.eventUsed[this.segment] = true;
    if (this.dnd) {
      this.dnd = false;
      this.out.push({ type: "blocked", by: "dnd" });
      return false;
    }
    const dialogue = this.run.dialogues[pool];
    this.event = { pool, dialogue, segment: this.segment };
    const key = `${pool}:${dialogue.line}`;
    if (!this.seen.includes(key)) this.seen.push(key);
    this.out.push({ type: "event", event: this.event });
    return true;
  }

  /** 主管的視線掃到玩家所在的線（B9）。該段第一次是「被叫住」突發事件，之後改成停 1 秒 */
  private checkGaze() {
    if (this.stun || this.event) return;
    for (const zone of LAYOUT.gazes) {
      if (zone.segment !== this.segment || this.consumed.has(zone.id)) continue;
      if (this.z < zone.z || this.z > zone.z + GAZE_LENGTH) continue;
      const lane = gazeLane(zone, this.clockSeconds);
      if (Math.abs(this.x - lane) >= 0.5) continue;
      this.consumed.add(zone.id);
      this.out.push({ type: "gaze" });
      if (this.dnd) {
        this.dnd = false;
        this.eventUsed[this.segment] = true;
        this.out.push({ type: "blocked", by: "dnd" });
        return;
      }
      this.calledByBoss = true;
      if (!this.eventUsed[this.segment]) this.triggerEvent("boss");
      else this.startStun("gaze", DELAY.gazeStop);
      return;
    }
  }

  private checkSegmentEnd() {
    const seg = LAYOUT.segments[this.segment];
    if (this.z < seg.start + seg.length) return;
    const ticks = this.tick - this.segmentStartTick;
    this.segmentTicks.push(ticks);
    const points = timeScore(SEGMENTS[this.segment].target, ticks);
    this.parts.time += points;
    this.out.push({ type: "segment", index: this.segment, time: ticks / TICKS_PER_SECOND, timeScore: points });
    if (this.segment === SEGMENT_COUNT - 1) {
      this.finished = true;
      const ending = endingFor(this.tick);
      this.out.push({ type: "finish", ending });
      this.result = this.makeResult(ending, null);
      return;
    }
    this.segment += 1;
    this.segmentStartTick = this.tick;
  }

  private makeResult(ending: Ending, short: number | null): SimResult {
    return {
      ending,
      hidden: ending !== "overtime" && !this.calledByBoss && !this.heldByColleague,
      clockTicks: this.tick,
      parts: { ...this.parts },
      total: totalScore(this.parts, ending),
      segmentTicks: [...this.segmentTicks],
      secondsShort: short,
      grazes: this.grazes,
    };
  }
}

export { LANES };
