import { SOUP, WALK } from "./config";
import { sampleAt } from "./path";
import { tilt, type FloorSim } from "./sim";

/**
 * 開發與測試用的自動駕駛：照「標準畫法」畫線（solver.ts 的 idealLine），走路時看湯面決定按住或放開。
 * 不追求最高分，只要穩定送到塔頂，讓截圖與自動測試能跑完整局。
 */
const RELEASE_AT = 0.27;
const HOLD_AGAIN = 0.14;
/** 往前看多遠的彎 */
const LOOK = 0.9;

export function autopilotHold(sim: FloorSim, wasHolding: boolean): boolean {
  const theta = tilt(sim);
  if (theta > RELEASE_AT) return false;
  // 前面有急彎：預估全速過彎的傾斜，太大就先放開減速
  let sharp = 0;
  for (let d = 0; d <= LOOK; d += 0.1) sharp = Math.max(sharp, Math.abs(sampleAt(sim.path, sim.s + d).kappa));
  const predicted = (SOUP.turnGain * WALK.speed * WALK.speed * sharp) / SOUP.k;
  if (predicted > 0.3 && sim.v > WALK.speed * 0.55) return false;
  if (!wasHolding && theta > HOLD_AGAIN) return false;
  return true;
}
