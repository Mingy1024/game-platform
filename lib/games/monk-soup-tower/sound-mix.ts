import { ENDING } from "./config";
import type { SessionEvent } from "./session";

/**
 * 音效的混音規則（驗收 M 組）。純計算，不碰 Web Audio，也不回頭影響模擬與判定（M4）。
 * 音檔用本機 Stable Audio 3 生成、使用者選片後匯出（提示詞與生成紀錄見 docs/sound/monk-soup-tower-prompts.md），
 * 放在 public/games/monk-soup-tower/0.1.0/sfx 與 music。
 *
 * AUDIO_READY：音檔已放進資料夾（2026-11-28）。改回 false 時不送任何音檔請求
 * （沒有音檔時不然每次進遊戲主控台都會出現十幾個 404，N6）。
 */
export const AUDIO_READY = true;

export const SOUND_FILES = [
  "brush-loop.wav",
  "slosh-loop.wav",
  "step-wood.mp3",
  "step-slip.mp3",
  "spill.mp3",
  "sizzle.mp3",
  "floor-clear.mp3",
  "summit-bell.mp3",
  "fall.mp3",
  "soup-cold.mp3",
  "score-tick.mp3",
  "new-record.mp3",
  "ui-click.mp3",
] as const;

export type SoundFile = (typeof SOUND_FILES)[number];
export type LoopName = "brush-loop.wav" | "slosh-loop.wav";
export type OneShot = Exclude<SoundFile, LoopName>;

export const SOUND_BASE = "/games/monk-soup-tower/0.1.0/sfx/";
export const MUSIC_URL = "/games/monk-soup-tower/0.1.0/music/bgm.mp3";
export const MUSIC_GAIN = 0.3;

export const SOUND_GAIN: Record<SoundFile, number> = {
  "brush-loop.wav": 0.45,
  "slosh-loop.wav": 0.5,
  "step-wood.mp3": 0.45,
  "step-slip.mp3": 0.6,
  "spill.mp3": 0.7,
  "sizzle.mp3": 0.5,
  "floor-clear.mp3": 0.7,
  "summit-bell.mp3": 0.75,
  "fall.mp3": 0.75,
  "soup-cold.mp3": 0.65,
  "score-tick.mp3": 0.3,
  "new-record.mp3": 0.7,
  "ui-click.mp3": 0.55,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** 畫線沙沙聲的音量：手指移動越快越大聲（px／秒，0～1200 對應 0～1） */
export const brushGain = (speedPx: number) => clamp(speedPx / 1200, 0, 1);

/** 湯晃動聲的音量：|θ| 越大越大聲（M2）。0.05 以下無聲，0.4 以上最大 */
export const sloshGain = (tilt: number) => clamp((tilt - 0.05) / 0.35, 0, 1);

/** 灑湯之後接燙塔的滋聲，延遲幾秒 */
export const SIZZLE_DELAY = 0.25;

/** 事件對應的單次音效（M2）；沒有聲音的事件回傳 null */
export function soundFor(event: SessionEvent): OneShot | null {
  switch (event.type) {
    case "step":
      return event.slip ? "step-slip.mp3" : "step-wood.mp3";
    case "spill":
      return "spill.mp3";
    case "fall":
      return "fall.mp3";
    case "cold":
      return "soup-cold.mp3";
    case "summit":
      return "summit-bell.mp3";
    case "floor":
      // 第 1 層的開場不敲木魚，之後每過一層敲一下
      return event.floor > 1 ? "floor-clear.mp3" : null;
    default:
      return null;
  }
}

/** 結算分數跑動時，跑分音的播放時間（秒）：1.2 秒內 12 聲 */
export const COUNT_UP_MS = ENDING.countUpMs;
export const tickTimes = (count = 12): number[] => Array.from({ length: count }, (_, i) => (i * COUNT_UP_MS) / 1000 / count);
