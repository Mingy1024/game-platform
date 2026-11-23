import type { SimEvent } from "./sim";

/**
 * 音效的混音規則（驗收 M 組）。純計算，不碰 Web Audio，也不回頭影響模擬與判定（M8）。
 * 音效由 Stable Audio 3 Small-SFX 生成，放在 public/games/mine-descent/0.1.0/sfx；背景音樂由 Small-Music 生成，放在 music；
 * 提示詞見 docs/sound/mine-descent-prompts.md。檔案不存在時遊戲照常可玩，只是沒有那個聲音。
 */
export const SOUND_FILES = [
  "ui-click.mp3",
  "game-start.mp3",
  "land.mp3",
  "fall-whoosh.mp3",
  "hurt.mp3",
  "near-miss.mp3",
  "combo-up.mp3",
  "rock-crack.mp3",
  "minecart-push.mp3",
  "wood-bounce.mp3",
  "crystal-pickup.mp3",
  "collapse-rumble.mp3",
  "game-over.mp3",
  "new-record.mp3",
  "score-tick.mp3",
] as const;

export type OneShot = (typeof SOUND_FILES)[number];

export const SOUND_BASE = "/games/mine-descent/0.1.0/sfx/";

/** 背景音樂（崩塌追逐）：和音效分開載入、分開計算大小；音量壓在音效底下 */
export const MUSIC_URL = "/games/mine-descent/0.1.0/music/bgm.mp3";
export const MUSIC_GAIN = 0.3;

export const SOUND_GAIN: Record<OneShot, number> = {
  "ui-click.mp3": 0.55,
  "game-start.mp3": 0.7,
  "land.mp3": 0.5,
  "fall-whoosh.mp3": 0.35,
  "hurt.mp3": 0.75,
  "near-miss.mp3": 0.6,
  "combo-up.mp3": 0.6,
  "rock-crack.mp3": 0.65,
  "minecart-push.mp3": 0.5,
  "wood-bounce.mp3": 0.65,
  "crystal-pickup.mp3": 0.6,
  "collapse-rumble.mp3": 0.45,
  "game-over.mp3": 0.75,
  "new-record.mp3": 0.7,
  "score-tick.mp3": 0.3,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** 落地音的音量：撞得越重越大聲（M2），落地速度 0～9 m/s 對應 0.5～1 倍 */
export const landGain = (impactVy: number) => 0.5 + 0.5 * clamp(impactVy / 9, 0, 1);

/** 驚險音的音調：連段越高越高（M3），最高 ×1.4 倍速 */
export const grazeRate = (mult: number) => clamp(1 + (mult - 1) * 0.4, 1, 1.4);

/** 崩塌隆隆聲的音量：頭離崩塌線越近越大（M5）。headroom 是頭到崩塌線的距離（公尺），超過 3 公尺無聲 */
export const rumbleGain = (headroom: number) => clamp(1 - headroom / 3, 0, 1) * 0.8;

/** 下降風聲的音量：下落速度超過 6 m/s 才有，9 m/s 時最大（M4） */
export const whooshGain = (vy: number) => clamp((vy - 6) / 3, 0, 1);

/** 模擬事件對應的音效；沒有對應的回傳 null */
export function soundFor(event: SimEvent): OneShot | null {
  switch (event.type) {
    case "land":
      return event.kind === "cart" ? "minecart-push.mp3" : event.kind === "spike" || event.kind === "wood" ? null : "land.mp3";
    case "hurt":
      return "hurt.mp3";
    case "bounce":
      return "wood-bounce.mp3";
    case "crystal":
      return "crystal-pickup.mp3";
    case "graze":
      return event.mult > 1 ? "combo-up.mp3" : "near-miss.mp3";
    case "crack":
      return "rock-crack.mp3";
    case "over":
      return "game-over.mp3";
    default:
      return null;
  }
}

/** 結算總分跑動的時間（毫秒），和畫面上的 CountUp 一致 */
export const COUNT_UP_MS = 1200;

/** 跑分音的播放時刻（秒，從結算畫面出現算起）：總分用 easeOutCubic 跑動，一開始密、後來疏 */
export function tickTimes(count = 14, durationMs = COUNT_UP_MS): number[] {
  const times: number[] = [];
  for (let i = 1; i <= count; i++) times.push((durationMs * (1 - Math.cbrt(1 - i / count))) / 1000);
  return times;
}
