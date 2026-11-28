/**
 * 和尚端湯上塔的數值設定。物理、計分、鏡頭、特效上限都集中在這裡，
 * 對應 docs/acceptance/monk-soup-tower.md 的 B、C、D、F、G、H 組。
 * 純邏輯，不依賴 three.js 與 DOM（驗收 Q2）。數值是遊戲化設定，試玩後再微調。
 */

/** 固定時間步長（秒）：60 Hz（B6） */
export const STEP = 1 / 60;
export const TICKS_PER_SECOND = 60;

/** 一局 5 層（A5） */
export const FLOORS = 5;

/** 畫線（B1–B3） */
export const DRAW = {
  /** 起點要在和尚腳下幾單位內 */
  startRadius: 0.9,
  /** 樓梯口金色圓圈的半徑 */
  goalRadius: 0.7,
  /** 放開後每隔幾單位取一點 */
  resample: 0.3,
  /** 模擬用的細分間距（平滑曲線上每隔幾單位一點） */
  fine: 0.05,
  /** 手機筆尖在手指上方幾 px（E1） */
  touchOffsetPx: 56,
  /** 一條線最多幾個原始點（避免手指在原地畫圈畫出幾萬個點） */
  maxRawPoints: 2000,
} as const;

/** 走路（B5） */
export const WALK = {
  /** 最高速度（單位／秒） */
  speed: 1.6,
  /** 按住幾秒加速到最高速 */
  accelSeconds: 0.25,
  /** 放開幾秒停下 */
  stopSeconds: 0.2,
  /** 滑區的加速度倍率（加速、減速都減半） */
  slipAccel: 0.5,
} as const;

/** 湯面（B6–B10） */
export const SOUP = {
  /** 彈簧與阻尼 */
  k: 40,
  c: 6,
  /** 灑出門檻（rad） */
  thetaMax: 0.35,
  /** 超過門檻的部分每 rad 每秒灑掉幾 %（(|θ| − 0.35) × 25%／秒） */
  spillPerRad: 25,
  /** 驅動 a 的增益：轉彎 v²×曲率、坡度變化、前後加減速 */
  turnGain: 6,
  slopeGain: 3,
  accelGain: 1.5,
  /** 滑區：a × 2、c × 0.5（B9） */
  slipA: 2,
  slipC: 0.5,
  /** 每經過一級階梯 a 加 6（B10）：在 stepPulse 秒內施加 */
  stepKick: 6,
  stepPulse: 0.1,
  /** 停下後回平的判定（|θ| < 0.02） */
  settled: 0.02,
} as const;

/** 灑出的湯漬（B11） */
export const DECAL = {
  /** 湯漬半徑（單位），之後經過算滑區 */
  radius: 0.32,
  /** 兩灘湯漬至少隔多遠（連續灑的時候） */
  spacing: 0.45,
  /** 冒熱氣秒數 */
  steamSeconds: 3,
  /** 一層最多幾灘 */
  maxPerFloor: 24,
} as const;

/** 溫度與計分（C 組） */
export const TEMP = {
  /** 開局溫度（℃） */
  start: 80,
  /** 每秒降幾度 */
  perSecond: 0.3,
  /** 低於這個溫度算涼掉 */
  cold: 50,
  /** 分段：≥70 熱騰騰、60–70 還很熱、50–60 溫溫的、<50 涼掉了 */
  hot: 70,
  warm: 60,
} as const;

export const SCORE = {
  max: 1000,
  /** 涼掉時的係數 */
  coldFactor: 0.5,
  /** 評級門檻（邊界屬於較高的一級） */
  grades: { S: 820, A: 680, B: 480 },
} as const;

/** 紀錄的上限（P5）：時間 1 秒～30 分鐘 */
export const LIMITS = { minTimeMs: 1000, maxTimeMs: 30 * 60 * 1000 } as const;

/** 這個總時間能不能上傳與分享（帳號同步和成績代碼共用同一個範圍） */
export const shareable = (timeMs: number): boolean => timeMs >= LIMITS.minTimeMs && timeMs <= LIMITS.maxTimeMs;

/** 塔的幾何（場景座標單位，每層各自以縮放 1 表示） */
export const TOWER = {
  /** 塔身半寬 */
  core: 3,
  /** 迴廊外緣 */
  rim: 5,
  /** 一層的高度 */
  levelHeight: 3.6,
  /** 第 1～5 層的外觀縮放（塔越高越窄；只影響外觀，判定都用縮放 1） */
  scale: [1.24, 1.12, 1.0, 0.9, 0.8],
  /** 樓梯口（不翻轉時） */
  goal: [4.0, -2.2] as const,
  /** 架高平台的高度 */
  platformHeight: 0.5,
  /** 可走地面最窄處（D5） */
  minWidth: 0.85,
} as const;

/** 鏡頭（F4、F5、G1、G5） */
export const CAMERA = {
  draw: { pos: [6.9, 22, 12.5] as const, target: [2.3, -0.5, 1.2] as const, fov: 39 },
  walk: { back: 2.8, inside: 0.9, height: 3.9, fov: 58, lookAhead: 1.4, lookY: -0.3 },
  /** 畫線鏡頭滑到肩後的秒數 */
  toWalkSeconds: 0.4,
  /** 過層：繞塔螺旋上升 */
  climbSeconds: 1.6,
  /** 減少動態效果時的過層停頓（鏡頭直接切換，牌子只淡入） */
  climbReducedSeconds: 0.5,
} as const;

/** 畫面安全區（D7）：390×844 的手機畫面，上方 HUD 140 px、下方按鈕 100 px */
export const SAFE = { width: 390, height: 844, top: 140, bottom: 100 } as const;

/** 層數牌（G1）：淡入、停、淡出 */
export const CARD = { fadeIn: 0.3, hold: 0.8, fadeOut: 0.3 } as const;

/** 結局動畫（G3、G4） */
export const ENDING = {
  /** 摔下去的慢動作秒數，之後顯示結算 */
  fallSeconds: 0.6,
  /** 湯灑光：停一下再結算 */
  emptySeconds: 0.8,
  /** 送達塔頂：鐘晃、塔剎發光的時間，之後顯示結算 */
  summitSeconds: 1.6,
  /** 分數跑動毫秒數 */
  countUpMs: 1200,
} as const;

/** 特效上限（G2、H6） */
export const FX = {
  /** 湯滴飛出的秒數 */
  dropSeconds: 0.4,
  /** 同時存在的湯滴上限 */
  maxDrops: 24,
} as const;

/** 畫質（H4、H5） */
export const QUALITY = {
  maxPixelRatio: 1.5,
  shadowMapSize: 1024,
  /** 連續幾秒低於幾 fps 就降畫質 */
  lowFps: 40,
  lowFpsSeconds: 2,
  /** 效能預算 */
  maxDrawCalls: 100,
  maxTriangles: 50_000,
} as const;

/** 隨機模式的塔號範圍 */
export const SEED = { min: 1, max: 999_999 } as const;
