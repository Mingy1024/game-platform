/**
 * 精準停車的數值設定。物理、計分、特效上限都集中在這裡，
 * 對應 docs/acceptance/precise-stop.md 的 B、C、G 組。
 */
export const PHYSICS = {
  /** 全力煞車減速度（m/s²） */
  fullBrake: 1.6,
  /** 按住後煞車力從 0 升到 100% 的秒數 */
  rampUp: 0.5,
  /** 放開後煞車力從 100% 歸零的秒數 */
  rampDown: 0.25,
  /** 滑行阻力（m/s²） */
  drag: 0.04,
  gravity: 9.81,
  /** 雨天煞車力倍率 */
  rainFactor: 0.75,
  /** 起始距離＝全力煞車停車距離 × 這個倍數 */
  startFactor: 1.6,
  /** 固定步進（秒） */
  step: 1 / 120,
  /** 速度為 0 維持這麼久才判定（秒） */
  settle: 0.3,
  /** 超過標線這麼遠就自動緊急停車（公尺） */
  overrunLimit: 15,
} as const;

export const SCORING = {
  perfect: 0.05,
  great: 0.3,
  good: 1,
  fair: 2,
  /** 連擊門檻：誤差在這個範圍內才算 */
  comboWithin: 0.3,
  comboStep: 0.1,
  comboMax: 1.5,
  /** 每超時一秒扣的分數 */
  overtimePerSecond: 50,
} as const;

/** 目標時間＝自動駕駛的理想時間 × 這個倍數，給玩家一點餘裕 */
export const TARGET_TIME_SLACK = 1.2;

export const STATIONS_PER_RUN = 5;

/** 特效粒子上限：火花＋彩帶同時最多 60 個 */
export const FX = {
  maxSparks: 36,
  maxConfetti: 24,
  /** 過站時的畫面震動幅度（設計尺寸的像素） */
  shakePx: 4,
  /** 車速超過這個值才出現速度線（km/h） */
  speedLinesAboveKmh: 40,
  /** 進入近站放大的距離（公尺） */
  zoomAt: 5,
} as const;

export const kmhToMs = (kmh: number) => kmh / 3.6;
export const msToKmh = (ms: number) => ms * 3.6;
