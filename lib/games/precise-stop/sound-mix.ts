import type { Judgement } from "./scoring";

/**
 * 音效的混音規則（驗收 R 組）。純計算，不碰 Web Audio，也不回頭影響物理與判定（R11）。
 */
export const SOUND_FILES = [
  "run-loop.wav",
  "brake-loop.wav",
  "stop.mp3",
  "final-5m.mp3",
  "judge-perfect.mp3",
  "judge-great.mp3",
  "judge-good.mp3",
  "judge-fair.mp3",
  "judge-miss.mp3",
  "score-tick.mp3",
  "new-record.mp3",
  "ui-click.mp3",
] as const;

export type SoundFile = (typeof SOUND_FILES)[number];
export type OneShot = Exclude<SoundFile, "run-loop.wav" | "brake-loop.wav">;

export const SOUND_BASE = "/games/precise-stop/0.1.0/sfx/";

/** 各音檔的音量（音檔本身都已正規化到同樣的峰值，這裡統一平衡） */
export const SOUND_GAIN: Record<SoundFile, number> = {
  "run-loop.wav": 0.42,
  "brake-loop.wav": 0.5,
  "stop.mp3": 0.75,
  "final-5m.mp3": 0.5,
  "judge-perfect.mp3": 0.7,
  "judge-great.mp3": 0.65,
  "judge-good.mp3": 0.45,
  "judge-fair.mp3": 0.45,
  "judge-miss.mp3": 0.65,
  "score-tick.mp3": 0.3,
  "new-record.mp3": 0.7,
  "ui-click.mp3": 0.55,
};

/** 行駛聲對應的車速範圍（km/h），音檔是用中等車速生成的 */
const RUN_LOW = 35;
const RUN_HIGH = 75;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * 行駛聲：音高與音量隨車速變化（R1）。
 * 35 km/h 以下音高繼續降、音量收小，停住時歸零（淡出交給播放端的平滑處理）。
 */
export function runLevel(speedKmh: number): { gain: number; rate: number } {
  if (speedKmh <= 0) return { gain: 0, rate: 0.7 };
  const t = clamp((speedKmh - RUN_LOW) / (RUN_HIGH - RUN_LOW), 0, 1);
  const rate = speedKmh >= RUN_LOW ? 0.9 + 0.3 * t : 0.7 + 0.2 * (speedKmh / RUN_LOW);
  const low = clamp(speedKmh / RUN_LOW, 0, 1);
  const gain = speedKmh >= RUN_LOW ? 0.75 + 0.25 * t : 0.75 * Math.sqrt(low);
  return { gain, rate };
}

/** 煞車聲：音量跟著煞車力（0–1），車停了就沒有摩擦聲（R2） */
export function brakeLevel(brake: number, speedKmh: number): number {
  if (speedKmh <= 0) return 0;
  // 快停住時摩擦聲跟著收掉，避免最後一下突然切斷
  return clamp(brake, 0, 1) * clamp(speedKmh / 4, 0, 1);
}

export function judgementSound(judgement: Judgement): OneShot {
  return `judge-${judgement}.mp3`;
}

/** 結算總分跑動的時間（毫秒），和畫面上的 CountUp 一致 */
export const COUNT_UP_MS = 1200;

/**
 * 跑分音的播放時刻（秒，從結算畫面出現算起）。
 * 總分用 easeOutCubic 跑動，每跑過 1/count 播一聲，所以一開始密、後來疏。
 */
export function tickTimes(count = 14, durationMs = COUNT_UP_MS): number[] {
  const times: number[] = [];
  for (let k = 0; k < count; k++) {
    const progress = k / count;
    times.push((1 - Math.cbrt(1 - progress)) * (durationMs / 1000));
  }
  return times;
}

/** 背景音樂（R13–R16）：和音效分開載入、分開計算大小 */
export const MUSIC_URL = "/games/precise-stop/0.1.0/music/bgm.mp3";

/** 背景音樂的音量：壓在音效底下 */
export const MUSIC_GAIN = 0.32;

/** 判定音、結算音出現時背景音樂暫時調小到的比例，以及持續秒數 */
export const DUCK_LEVEL = 0.35;

export function duckSeconds(name: OneShot): number {
  if (name === "new-record.mp3") return 2.4;
  if (name.startsWith("judge-")) return 1.6;
  if (name === "score-tick.mp3") return 0.25;
  return 0;
}
