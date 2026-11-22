import type { SimEvent } from "./sim";

/**
 * 音效的混音規則（驗收 M 組）。純計算，不碰 Web Audio，也不回頭影響模擬與判定（M13）。
 * 音檔由使用者用本機模型生成後放進 public/games/office-escape/0.1.0/sfx 與 music；
 * 提示詞見 docs/sound/office-escape-prompts.md。檔案不存在時遊戲照常可玩，只是沒有那個聲音。
 */
export const SOUND_FILES = [
  "run-loop.wav",
  "lane.mp3",
  "jump.mp3",
  "land.mp3",
  "graze.mp3",
  "bump.mp3",
  "delay-tick.mp3",
  "pickup-coffee.mp3",
  "pickup-headphones.mp3",
  "pickup-dnd.mp3",
  "event.mp3",
  "answer-right.mp3",
  "answer-wrong.mp3",
  "chime.mp3",
  "door-spin.mp3",
  "reader.mp3",
  "ending-fast.mp3",
  "ending-ontime.mp3",
  "ending-overtime.mp3",
  "ending-hidden.mp3",
  "score-tick.mp3",
  "new-record.mp3",
  "ui-click.mp3",
] as const;

export type SoundFile = (typeof SOUND_FILES)[number];
export type OneShot = Exclude<SoundFile, "run-loop.wav">;

export const SOUND_BASE = "/games/office-escape/0.1.0/sfx/";
export const MUSIC_URL = "/games/office-escape/0.1.0/music/bgm.mp3";
export const MUSIC_GAIN = 0.35;
/** 事件出現、結算時背景音樂調小到這個比例 */
export const DUCK_LEVEL = 0.35;

export const SOUND_GAIN: Record<SoundFile, number> = {
  "run-loop.wav": 0.42,
  "lane.mp3": 0.4,
  "jump.mp3": 0.5,
  "land.mp3": 0.5,
  "graze.mp3": 0.55,
  "bump.mp3": 0.7,
  "delay-tick.mp3": 0.45,
  "pickup-coffee.mp3": 0.6,
  "pickup-headphones.mp3": 0.6,
  "pickup-dnd.mp3": 0.6,
  "event.mp3": 0.65,
  "answer-right.mp3": 0.7,
  "answer-wrong.mp3": 0.7,
  "chime.mp3": 0.6,
  "door-spin.mp3": 0.6,
  "reader.mp3": 0.5,
  "ending-fast.mp3": 0.7,
  "ending-ontime.mp3": 0.7,
  "ending-overtime.mp3": 0.7,
  "ending-hidden.mp3": 0.7,
  "score-tick.mp3": 0.3,
  "new-record.mp3": 0.7,
  "ui-click.mp3": 0.55,
};

/** 這個音效出現時，背景音樂調小幾秒 */
export function duckSeconds(name: OneShot): number {
  if (name.startsWith("ending-")) return 3.5;
  if (name === "event.mp3") return 0.8;
  if (name === "answer-right.mp3" || name === "answer-wrong.mp3" || name === "new-record.mp3") return 1.2;
  return 0;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** 奔跑聲：音量與音高跟著速度（咖啡加速時節奏變快，M1）。speed 是公尺／秒，停住時歸零 */
export function runLevel(speed: number): { gain: number; rate: number } {
  if (speed <= 0) return { gain: 0, rate: 0.8 };
  const t = clamp((speed - 6) / (8.4 - 6), 0, 1);
  return { gain: 0.75 + 0.25 * t, rate: 0.9 + 0.5 * t };
}

/** 擦身閃避的音調：連段越高越高（M3），最高 ×1.5 倍速 */
export const grazeRate = (streak: number) => clamp(1 + 0.1 * (streak - 1), 1, 1.5);

/** 模擬事件對應的音效；沒有對應的回傳 null */
export function soundFor(event: SimEvent): OneShot | null {
  switch (event.type) {
    case "lane":
      return "lane.mp3";
    case "jump":
      return "jump.mp3";
    case "land":
      return "land.mp3";
    case "graze":
      return "graze.mp3";
    case "hit":
      return "bump.mp3";
    case "door":
      return event.passed ? "reader.mp3" : "bump.mp3";
    case "gaze":
      return "event.mp3";
    case "pickup":
      return event.item === "coffee" ? "pickup-coffee.mp3" : event.item === "headphones" ? "pickup-headphones.mp3" : "pickup-dnd.mp3";
    case "event":
      return "event.mp3";
    case "answer":
      return event.grade === 2 ? "answer-wrong.mp3" : "answer-right.mp3";
    case "reader":
      return "reader.mp3";
    case "finish":
      return "door-spin.mp3";
    default:
      return null;
  }
}

export function endingSound(ending: "fast" | "ontime" | "overtime", hidden: boolean): OneShot {
  return hidden ? "ending-hidden.mp3" : (`ending-${ending}.mp3` as OneShot);
}

/** 結算總分跑動的時間（毫秒），和畫面上的 CountUp 一致 */
export const COUNT_UP_MS = 1200;

/** 跑分音的播放時刻（秒，從結算畫面出現算起）：總分用 easeOutCubic 跑動，一開始密、後來疏 */
export function tickTimes(count = 14, durationMs = COUNT_UP_MS): number[] {
  const times: number[] = [];
  for (let i = 1; i <= count; i++) times.push((durationMs * (1 - Math.cbrt(1 - i / count))) / 1000);
  return times;
}
