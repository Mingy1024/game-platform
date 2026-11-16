import { SCORING } from "./config";

export type Judgement = "perfect" | "great" | "good" | "fair" | "miss";

const EPS = 1e-9;

/** 依車頭與標線的誤差（公尺，正負都可以）判定等級。剛好在邊界時歸在較好的一級。 */
export function judge(errorM: number): Judgement {
  const e = Math.abs(errorM);
  if (e <= SCORING.perfect + EPS) return "perfect";
  if (e <= SCORING.great + EPS) return "great";
  if (e <= SCORING.good + EPS) return "good";
  if (e <= SCORING.fair + EPS) return "fair";
  return "miss";
}

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

/** 停車分（0–1000，整數） */
export function stopScore(errorM: number): number {
  const e = Math.abs(errorM);
  switch (judge(errorM)) {
    case "perfect":
      return 1000;
    case "great":
      return Math.round(
        lerp(990, 850, (e - SCORING.perfect) / (SCORING.great - SCORING.perfect)),
      );
    case "good":
      return Math.round(
        lerp(850, 500, (e - SCORING.great) / (SCORING.good - SCORING.great)),
      );
    case "fair":
      return Math.round(
        lerp(500, 100, (e - SCORING.good) / (SCORING.fair - SCORING.good)),
      );
    default:
      return 0;
  }
}

/** 超時秒數，以 0.1 秒為單位無條件捨去 */
export function overtimeSeconds(elapsed: number, target: number): number {
  const over = elapsed - target;
  if (over <= 0) return 0;
  return Math.floor(over * 10 + EPS) / 10;
}

export function overtimePenalty(elapsed: number, target: number): number {
  return Math.round(overtimeSeconds(elapsed, target) * SCORING.overtimePerSecond);
}

/** 連續停在 30 cm 內的站數 → 倍率。第 1 站 ×1.0，第 2 站 ×1.1……最高 ×1.5。 */
export function comboMultiplier(streak: number): number {
  if (streak <= 1) return 1;
  const value = 1 + (streak - 1) * SCORING.comboStep;
  return Math.min(SCORING.comboMax, Math.round(value * 10) / 10);
}

export type StopInput = {
  /** 誤差（公尺）。正值過站、負值停在標線前。 */
  error: number;
  elapsed: number;
  target: number;
  /** 自動緊急停車，一律算失誤 */
  emergency?: boolean;
};

export type StopResult = {
  judgement: Judgement;
  error: number;
  stopScore: number;
  overtime: number;
  penalty: number;
  /** 這一站套用的倍率 */
  multiplier: number;
  /** 這一站結束後的連擊站數（給下一站用） */
  streak: number;
  score: number;
};

/** 算出一站的得分。streakBefore 是進這一站之前已經連續停準幾站。 */
export function scoreStop(input: StopInput, streakBefore: number): StopResult {
  const judgement: Judgement = input.emergency ? "miss" : judge(input.error);
  const base = judgement === "miss" ? 0 : stopScore(input.error);
  const overtime = overtimeSeconds(input.elapsed, input.target);
  const penalty = judgement === "miss" ? 0 : overtimePenalty(input.elapsed, input.target);
  const inCombo =
    judgement !== "miss" && Math.abs(input.error) <= SCORING.comboWithin + EPS;
  const streak = inCombo ? streakBefore + 1 : 0;
  const multiplier = inCombo ? comboMultiplier(streak) : 1;
  const score = Math.round(Math.max(0, base - penalty) * multiplier);
  return {
    judgement,
    error: input.error,
    stopScore: base,
    overtime,
    penalty,
    multiplier,
    streak,
    score,
  };
}

/** 依序算出整局每一站的結果 */
export function scoreRun(stops: StopInput[]): StopResult[] {
  const results: StopResult[] = [];
  let streak = 0;
  for (const stop of stops) {
    const result = scoreStop(stop, streak);
    streak = result.streak;
    results.push(result);
  }
  return results;
}

export function totalScore(results: StopResult[]): number {
  return results.reduce((sum, result) => sum + result.score, 0);
}
