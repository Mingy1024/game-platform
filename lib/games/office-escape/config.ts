/**
 * 下班逃離辦公室的數值設定。移動、計分、特效上限都集中在這裡，
 * 對應 docs/acceptance/office-escape.md 的 B、C、G 組。
 * 純邏輯，不依賴 three.js 與 DOM（驗收 Q2）。
 */

/** 固定時間步長（秒），B4 */
export const STEP = 1 / 120;
export const TICKS_PER_SECOND = 120;

/** 三條線：-1 左、0 中、1 右。線寬單位：1 = 一條線的寬度 */
export const LANES = [-1, 0, 1] as const;
export type Lane = (typeof LANES)[number];
/** 一條線的實際寬度（公尺），只用在場景座標 */
export const LANE_WIDTH_M = 1.4;

export const MOVE = {
  /** 前進速度（公尺／秒），第 1 段；之後每段加快 10%（B1） */
  baseSpeed: 6,
  segmentSpeedUp: 1.1,
  /** 咖啡加速倍率與持續秒數（B1、B13） */
  coffeeFactor: 1.4,
  coffeeSeconds: 3,
  /** 耳機持續秒數 */
  headphonesSeconds: 3,
  /** 換線歷時（秒），B2 */
  laneSeconds: 0.15,
  /** 跳躍滯空（秒），B3 */
  jumpSeconds: 0.5,
  /** 跳躍進行到這個比例之間才算「在空中」可以越過障礙 */
  airFrom: 0.15,
  airTo: 0.85,
} as const;

/** 判定寬度（線寬單位）：玩家半寬、障礙半寬、擦身範圍（C2：小於 0.3 個線寬） */
export const HIT = { player: 0.2, obstacle: 0.4, graze: 0.3 } as const;

/** 被耽誤的時間（秒），B5–B7、B9、B12 */
export const DELAY = {
  held: 1.5,
  trip: 1,
  door: 4,
  gazeStop: 1,
  wrongAnswerJump: 5,
} as const;

/** 突發事件：放慢到 20%，限時 3 秒（B11） */
export const EVENT = { slowFactor: 0.2, limitSeconds: 3 } as const;

/** 時鐘：18:00:00 起算，主管 18:01:30 點名；60 秒內出門 ×2.0，90 秒內 ×1.5，被攔下 ×1.0（C6） */
export const CLOCK = {
  startSeconds: 18 * 3600,
  fastUntil: 60,
  callAt: 90,
  fastMultiplier: 2,
  onTimeMultiplier: 1.5,
  overtimeMultiplier: 1,
} as const;

/** 分數（第 2 節） */
export const SCORE = {
  /** 比目標早到，每 0.1 秒加幾分（C1） */
  perTenth: 10,
  graze: 50,
  grazeStep: 0.1,
  grazeMax: 1.5,
  eventBest: 300,
  eventNormal: 100,
  item: 20,
} as const;

export const SEGMENTS = [
  { id: "office", target: 20 },
  { id: "corridor", target: 25 },
  { id: "elevator", target: 20 },
  { id: "lobby", target: 15 },
] as const;
export type SegmentId = (typeof SEGMENTS)[number]["id"];
export const SEGMENT_COUNT = SEGMENTS.length;

/**
 * 每段的長度＝基本速度 × 目標時間 × 這個比例（四捨五入到 0.5 公尺）。
 * 設計稿只寫了目標時間、沒寫長度；0.7 讓「不被耽誤」的一局約 56 秒，剛好能趕上 ×2.0，被耽誤約 4 秒內仍可拿到（偏離清單）。
 */
export const SEGMENT_LENGTH_RATIO = 0.7;

/** 障礙密度：每幾秒一組（第 1 段 2 秒、第 4 段 1.2 秒，B14） */
export const ROW_INTERVAL_SECONDS = [2, 1.8, 1.5, 1.2] as const;

/** 特效粒子上限（G7） */
export const FX = { maxParticles: 60 } as const;

export const STORY_LINES_PER_POOL = 20;
export const LINES_TOTAL = STORY_LINES_PER_POOL * 3;
