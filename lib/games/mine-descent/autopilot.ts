import { LAYER, PLAYER, REACH_GAP } from "./config";
import { ceilingY, type Platform, type Sim } from "./sim";

/**
 * 自動駕駛：開發版的 window.__mineDescent 用它跑完整局、截圖、E2E，也用在單元測試驗證「每層都有路」。
 * 做法很單純：站在一般岩板上等到快撞到崩塌線，再往下一層「看起來最安全」的岩板走；在空中朝目標修正。
 * 純邏輯。
 */
const PREFERENCE: Record<string, number> = { rock: 0, crystal: 0.1, cart: 0.6, wood: 0.8, crack: 9, spike: 9 };

const spanDistance = (platform: Platform, x: number) => Math.max(0, Math.abs(x - platform.x) - platform.w / 2 + 0.2);

/** 往下最近的一層裡「看起來最安全」的岩板；只看最近的一層，目標才不會一直換 */
/** 0 安全、1 碎裂、2 尖刺 */
const LEVEL: Record<string, number> = { rock: 0, cart: 0, wood: 0, crystal: 0, crack: 1, spike: 2 };
const chosen = new WeakMap<Sim, number>();

function pickTarget(sim: Sim, below: number): Platform | null {
  const p = sim.player;
  // 已經選好的目標還能用就繼續用，不要因為自己走動一點就換來換去
  const keep = sim.platforms.find((platform) => platform.id === chosen.get(sim));
  if (keep && keep.state !== "falling" && LEVEL[keep.kind] === 0 && keep.y >= below + 0.3 && keep.y <= p.y + 4.2) return keep;
  // 安全的岩板優先；一層裡只有碎裂或尖刺時，寧可扣血或站一下，也不要掉出畫面
  const eligible = sim.platforms.filter((platform) => platform.state !== "falling" && platform.y >= below + 0.3 && platform.y <= p.y + 4.2);
  const safe = [0, 1, 2].map((level) => eligible.filter((platform) => LEVEL[platform.kind] <= level)).find((list) => list.length > 0) ?? [];
  if (safe.length === 0) return null;
  const rowY = Math.min(...safe.map((platform) => platform.y));
  const isSafe = (platform: Platform) => platform.state !== "falling" && platform.kind !== "spike" && platform.kind !== "crack";
  // 往前多看一層：落下去以後，下一層還有沒有走得到的安全岩板（不然會被困在死路上）
  const hasWayOn = (from: Platform) =>
    sim.platforms.some(
      (q) =>
        isSafe(q) &&
        Math.abs(q.y - (from.y + LAYER)) < 0.05 &&
        Math.max(0, Math.max(from.x - from.w / 2, q.x - q.w / 2) - Math.min(from.x + from.w / 2, q.x + q.w / 2)) <= REACH_GAP,
    );
  let best: Platform | null = null;
  let bestScore = Infinity;
  for (const platform of safe) {
    if (Math.abs(platform.y - rowY) > 0.05) continue;
    const score = spanDistance(platform, p.x) + (PREFERENCE[platform.kind] ?? 1) + (hasWayOn(platform) ? 0 : 6);
    if (score < bestScore) {
      best = platform;
      bestScore = score;
    }
  }
  if (best) chosen.set(sim, best.id);
  return best;
}

export function autopilotAxis(sim: Sim): -1 | 0 | 1 {
  const p = sim.player;
  const current = p.ground === null ? null : (sim.platforms.find((platform) => platform.id === p.ground) ?? null);
  const danger = p.y - PLAYER.height - ceilingY(sim.scrolled) < 3.4;
  if (current) {
    const mustLeave = danger || current.kind === "crack" || current.kind === "spike" || current.kind === "wood";
    if (!mustLeave) return 0;
    const target = pickTarget(sim, current.y);
    if (!target) return p.x < current.x ? -1 : 1;
    // 目標在這塊岩板的中間下方時，先走到最近的邊緣再掉下去
    const edgeLeft = current.x - current.w / 2;
    const edgeRight = current.x + current.w / 2;
    const extendsLeft = target.x - target.w / 2 < edgeLeft - 0.1;
    const extendsRight = target.x + target.w / 2 > edgeRight + 0.1;
    // 目標伸出哪一邊就往那一邊走；兩邊都伸出就走最近的邊緣
    if (extendsLeft && !extendsRight) return -1;
    if (extendsRight && !extendsLeft) return 1;
    if (extendsLeft && extendsRight) return p.x < current.x ? -1 : 1;
    // 目標整個在這塊岩板正下方：從離目標比較近的那一側邊緣下去，落下時不用走太遠
    const toLeft = Math.max(0, target.x - target.w / 2 - edgeLeft);
    const toRight = Math.max(0, edgeRight - (target.x + target.w / 2));
    return toLeft <= toRight ? -1 : 1;
  }
  const target = pickTarget(sim, p.y - 0.2);
  if (!target) return 0;
  const goal = Math.min(target.x + target.w / 2 - 0.25, Math.max(target.x - target.w / 2 + 0.25, p.x));
  if (Math.abs(goal - p.x) < 0.05) return 0;
  return goal < p.x ? -1 : 1;
}
