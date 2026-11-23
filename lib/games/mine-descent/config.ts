/**
 * 礦坑大逃亡（礦坑版）的數值設定。移動、計分、特效上限都集中在這裡，
 * 對應 docs/acceptance/mine-descent.md 的 B、C、D、G 組。
 * 純邏輯，不依賴 Phaser 與 DOM（驗收 Q2）。
 */

/** 固定時間步長（秒），B12 */
export const STEP = 1 / 120;
export const TICKS_PER_SECOND = 120;

/** 場地：寬 6 m、高 8 m（直式 3:4）。座標 y 向下，0 是畫面頂端。更長的螢幕見下面的 VIEW */
export const FIELD = { width: 6, height: 8 } as const;
/**
 * 畫面實際看得到的高度（公尺）：預設就是場地高 8 m（3:4）；手機螢幕比 3:4 更長時，
 * 遊戲框會填滿整個螢幕，多出來的高度往下延伸，讓玩家看到更遠的岩板，不留空白。
 * 上限 13 m（約 6:13）；再長的螢幕只留一點邊。
 */
export const VIEW = { min: FIELD.height, max: 13 } as const;
/** 岩板每一層的間距（公尺）。捲動速度用「層／秒」表示 */
export const LAYER = 1.6;
/** 岩板厚度（公尺），只影響繪製與擦身判定 */
export const PLATFORM_THICKNESS = 0.24;

export const PLAYER = {
  /** 腳底以上的身高、半寬（公尺） */
  height: 0.7,
  halfWidth: 0.25,
  /** 左右最高速度 m/s；0.1 秒加到滿、放開後 0.08 秒停住（B1） */
  maxSpeed: 4.5,
  accelSeconds: 0.1,
  stopSeconds: 0.08,
  /** 重力 m/s²、下落最快速度 m/s（B2） */
  gravity: 30,
  maxFall: 9,
  /** 站上去以後起始的 y（螢幕上方 4.5 m 處） */
  startY: 4.5,
} as const;

export const HEALTH = {
  max: 6,
  /** 站在一般岩板上每幾秒回 1 格（B6） */
  regenSeconds: 1,
  /** 扣血後的無敵秒數（B7） */
  invulnSeconds: 0.8,
  /** 踩到尖刺後的小跳速度 m/s（B8） */
  spikeHop: 4.5,
} as const;

/** 各種岩板的行為（B3–B5） */
export const PLATFORM = {
  /** 碎裂：站上去幾秒後掉落 */
  crackSeconds: 0.4,
  /** 礦軌推車：站在上面被推的速度 m/s */
  cartPush: 2.2,
  /** 木支架：彈起的高度（層數），速度由重力算出 */
  bounceLayers: 2,
  /** 崩塌線：被頭頂撞到後，往下穿過岩板的秒數（不然會一直卡在岩板上） */
  squeezeSeconds: 0.5,
} as const;

/** 岩板寬度範圍與一層的數量（D1、D2） */
export const ROW = { minWidth: 1.2, maxWidth: 2.4, minCount: 1, maxCount: 3, edgeMargin: 0.1 } as const;
/** 前一層與這一層「一定走得到」的岩板，邊緣到邊緣最多隔多遠（公尺，D3） */
export const REACH_GAP = 0.6;

/** 崩塌線：起始位置、隨深度往下壓的距離與上限（公尺，B9） */
export const CEILING = { base: 0.9, perMeter: 0.0015, max: 1.2 } as const;

/** 深度分段（D4）：scene 是背景編號，speed 是捲動速度（層／秒） */
export const ZONES = [
  { from: 0, scene: 0, speed: 0.7 },
  { from: 100, scene: 1, speed: 0.8 },
  { from: 250, scene: 2, speed: 0.9 },
  { from: 450, scene: 3, speed: 1.0 },
  { from: 700, scene: 4, speed: 1.1 },
] as const;
/** 700 m 以後每 100 m 加快的層／秒，與上限（D5） */
export const SPEED_RAMP = { perHundred: 0.05, max: 1.5 } as const;

/** 各段的岩板比例（權重，D6）；順序與 KINDS 相同 */
export const KINDS = ["rock", "spike", "crack", "cart", "wood", "crystal"] as const;
export type Kind = (typeof KINDS)[number];
export const MIX: Record<number, readonly [number, number, number, number, number, number]> = {
  0: [70, 15, 15, 0, 0, 0],
  1: [55, 15, 15, 15, 0, 0],
  2: [50, 15, 15, 8, 6, 6],
  3: [30, 25, 20, 10, 8, 7],
  4: [30, 25, 20, 8, 9, 8],
};
/** 保證能走的「主路」岩板種類（不含尖刺、碎裂，也不含木支架：它會把人彈去撞崩塌線，不能當一定走得通的路） */
export const ANCHOR_KINDS: readonly Kind[] = ["rock", "cart", "crystal"];

/** 計分（C 組） */
export const SCORE = {
  /** 每下降 1 公尺 */
  perMeter: 10,
  /** 驚險（邊緣落腳、擦過崩塌線）與水晶 */
  graze: 50,
  crystal: 30,
  /** 邊緣落腳：落點離岩板邊緣的比例 */
  edgeRatio: 0.1,
  /** 擦過崩塌線：頭離崩塌線小於身高的這個比例 */
  ceilingGrazeRatio: 0.5,
  /** 同一道崩塌線連續兩次擦過至少間隔幾秒 */
  ceilingGrazeCooldown: 1,
  /** 連段倍率：第一次 ×1.2，每次 +0.2，上限 ×2.0；多久沒有驚險就歸零（秒） */
  multStart: 1.2,
  multStep: 0.2,
  multMax: 2,
  multSeconds: 10,
} as const;

/** 分數與深度的上限，只用來擋明顯不合理的資料（P4）；不重算分數 */
export const MAX_DEPTH = 100_000;
export const MAX_SCORE = 5_000_000;

/** 特效與粒子上限（G 組） */
export const FX = { maxParticles: 160, dustPerLand: 6, slowmoSeconds: 0.2, slowmoScale: 0.4 } as const;

/** 失敗的結算：延遲幾秒才顯示結算面板（讓暈眩動畫播完） */
export const OVER_DELAY_SECONDS = 1.2;
