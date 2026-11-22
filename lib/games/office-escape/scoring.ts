import { CLOCK, SCORE, TICKS_PER_SECOND } from "./config";

/** 結局：秒速下班、準時下班、加班（被主管攔下）；hidden 是另外的旗標（C9） */
export type Ending = "fast" | "ontime" | "overtime";

/** 0.1 秒＝12 個步長 */
const TENTH = TICKS_PER_SECOND / 10;

/** 時間分：比目標早到每 0.1 秒加 10 分，不足 0.1 秒捨去，晚到得 0（C1）。elapsedTicks 是這一段用掉的步長數 */
export function timeScore(targetSeconds: number, elapsedTicks: number): number {
  const early = Math.floor((targetSeconds * TICKS_PER_SECOND - elapsedTicks) / TENTH);
  return Math.max(0, early) * SCORE.perTenth;
}

/** 連續擦身的倍率（C3）：第 1 次 ×1.0、第 2 次 ×1.1，之後每次 +0.1，最高 ×1.5。streak 是含這一次的連續次數 */
export function grazeMultiplier(streak: number): number {
  if (streak <= 1) return 1;
  return Math.min(SCORE.grazeMax, Math.round((1 + SCORE.grazeStep * (streak - 1)) * 100) / 100);
}

export const grazePoints = (streak: number) => Math.round(SCORE.graze * grazeMultiplier(streak));

/** 突發事件的得分：0 最佳、1 普通、2 錯誤（C4） */
export const eventPoints = (grade: number) => (grade === 0 ? SCORE.eventBest : grade === 1 ? SCORE.eventNormal : 0);

/** 衝出大門時的結局。剛好 60.0／90.0 秒歸在較好的那一級（C6） */
export function endingFor(clockTicks: number): Ending {
  if (clockTicks <= CLOCK.fastUntil * TICKS_PER_SECOND) return "fast";
  if (clockTicks <= CLOCK.callAt * TICKS_PER_SECOND) return "ontime";
  return "overtime";
}

export const multiplierFor = (ending: Ending): number =>
  ending === "fast" ? CLOCK.fastMultiplier : ending === "ontime" ? CLOCK.onTimeMultiplier : CLOCK.overtimeMultiplier;

export type ScoreParts = { time: number; graze: number; event: number; item: number };

/** 總分＝（時間分＋閃避分＋事件分＋道具分）× 準時倍率，四捨五入（C7） */
export function totalScore(parts: ScoreParts, ending: Ending): number {
  return Math.round((parts.time + parts.graze + parts.event + parts.item) * multiplierFor(ending));
}

/** 「差 N 秒就衝出大門」：剩餘距離除以目前的速度，進位到 0.1 秒（C8） */
export function secondsShort(remainingMeters: number, speed: number): number {
  return Math.ceil((remainingMeters / speed) * 10 - 1e-9) / 10;
}

/** 時鐘字串 18:00:24（只用在畫面，tick 轉成時分秒） */
export function clockText(clockTicks: number): string {
  const total = CLOCK.startSeconds + Math.floor(clockTicks / TICKS_PER_SECOND);
  const h = Math.floor(total / 3600) % 24;
  const m = Math.floor(total / 60) % 60;
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** 距離主管點名還剩幾秒（不小於 0） */
export const secondsToCall = (clockTicks: number) => Math.max(0, CLOCK.callAt - clockTicks / TICKS_PER_SECOND);
