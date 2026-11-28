import { SCORE, TEMP } from "./config";

/**
 * 計分（C 組）。湯量用千分比（permille，0～1000）保存，畫面顯示時四捨五入成 %。
 * 得分 = round(湯量% × 10 × 溫度係數) = round(湯量千分比 × 溫度係數)，0～1000（C4）。
 */
export type Grade = "S" | "A" | "B" | "C";
export type TempBand = "hot" | "veryWarm" | "warm" | "cold";

/** 經過 ms 毫秒後的溫度（C1）。不會低於 0℃ */
export const temperatureAt = (ms: number): number => Math.max(0, TEMP.start - (TEMP.perSecond * ms) / 1000);

/** 溫度分段（C2）：70 以上熱騰騰、60～70 還很熱、50～60 溫溫的、低於 50 涼掉了；邊界屬於較熱的一段 */
export function tempBand(celsius: number): TempBand {
  if (celsius >= TEMP.hot) return "hot";
  if (celsius >= TEMP.warm) return "veryWarm";
  if (celsius >= TEMP.cold) return "warm";
  return "cold";
}

/** 溫度係數（C3）：50～80℃ 從 0.7 到 1.0；低於 50℃ 涼掉 0.5 */
export function tempFactor(celsius: number): number {
  if (celsius < TEMP.cold) return SCORE.coldFactor;
  const t = Math.min(TEMP.start, celsius);
  return 0.7 + (0.3 * (t - TEMP.cold)) / (TEMP.start - TEMP.cold);
}

/** 得分（C4）。soupPermille：剩下的湯（千分比）；ms：總時間 */
export function scoreOf(soupPermille: number, ms: number): number {
  const soup = Math.max(0, Math.min(1000, soupPermille));
  return Math.max(0, Math.min(SCORE.max, Math.round(soup * tempFactor(temperatureAt(ms)))));
}

/** 評級（C5）：S ≥ 820、A ≥ 680、B ≥ 480、其餘 C */
export function gradeOf(score: number): Grade {
  if (score >= SCORE.grades.S) return "S";
  if (score >= SCORE.grades.A) return "A";
  if (score >= SCORE.grades.B) return "B";
  return "C";
}

/** 兩筆成績誰比較好（C7）：分數高的較好；同分時間短的較好。a 比 b 好回傳負數 */
export const compareRuns = (a: { score: number; timeMs: number }, b: { score: number; timeMs: number }): number =>
  b.score - a.score || a.timeMs - b.timeMs;

/**
 * 顯示用的溫度（1 位小數，無條件捨去）。不能四捨五入：49.97℃ 已經「涼掉了」，顯示成 50℃ 會和分段矛盾（Codex 審查第 2 輪）。
 * 整數顯示一律用 Math.floor，分段的門檻都是整數，捨去後一定還在同一段。
 */
export const displayTemp = (ms: number): number => Math.floor(temperatureAt(ms) * 10 + 1e-9) / 10;

/** 顯示用的湯量 %（四捨五入到整數） */
export const soupPercent = (permille: number): number => Math.round(Math.max(0, permille) / 10);

/** 秒數顯示（一位小數），小數點依語系：越南文、葡文是逗號（翻譯版面檢查） */
export const secondsText = (ms: number, locale: string): string =>
  new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.round(ms / 100) / 10);
