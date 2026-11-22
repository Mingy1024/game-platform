import { LANES, STEP, TICKS_PER_SECOND, type Lane } from "./config";
import { JUMPABLE, LAYOUT, gazeLane, openDoorLane } from "./route";
import type { Sim } from "./sim";

/**
 * 自動駕駛：測試、截圖與 E2E 用。每一步看前方 14 公尺：避開擋路的障礙、越過紙箱與椅子、
 * 在電梯門前站到開著的那條線、避開主管的視線，並撿道具。突發事件一律選最佳。
 */
export type Action = { lane?: -1 | 1; jump?: boolean; answer?: number };

const LOOKAHEAD = 14;

export function autopilotAction(sim: Sim): Action {
  if (sim.event) return { answer: sim.event.dialogue.order.indexOf(0) };
  if (sim.over || sim.stun) return {};
  const z = sim.z;
  const seg = sim.segment;
  const speed = sim.speed;

  const cost: Record<Lane, number> = { [-1]: 0, 0: 0, 1: 0 };
  let nearestJump: { lane: Lane; dist: number } | null = null;
  let rowZ = Infinity;
  for (const o of LAYOUT.obstacles) {
    if (o.segment !== seg || o.z <= z || o.z > z + LOOKAHEAD) continue;
    if (o.z < rowZ) rowZ = o.z;
  }
  for (const o of LAYOUT.obstacles) {
    if (o.segment !== seg || o.z <= z || o.z > z + LOOKAHEAD) continue;
    const harmless = o.kind === "chatter" && sim.headphonesLeft > 0;
    if (harmless) continue;
    if (JUMPABLE.has(o.kind)) {
      cost[o.lane] += 1;
      if (!nearestJump || o.z - z < nearestJump.dist) nearestJump = { lane: o.lane, dist: o.z - z };
    } else cost[o.lane] += 100;
  }
  for (const item of sim.run.items) {
    if (item.segment !== seg || item.z <= z || item.z > z + LOOKAHEAD) continue;
    cost[item.lane] -= 0.6;
  }
  for (const door of LAYOUT.doors) {
    if (door.segment !== seg || door.z <= z || door.z > z + LOOKAHEAD) continue;
    const eta = (door.z - z) / speed;
    const open = openDoorLane(door, sim.clockSeconds + eta);
    for (const lane of LANES) if (lane !== open) cost[lane] += 100;
  }
  for (const zone of LAYOUT.gazes) {
    if (zone.segment !== seg || z > zone.z + zone.length || z < zone.z - 8) continue;
    // 視線每 1.5 秒換一條線；預測走進區域時它會看哪裡
    const eta = Math.max(0, (zone.z - z) / speed);
    for (const lane of LANES) {
      if (lane === gazeLane(zone, sim.clockSeconds + eta) || lane === gazeLane(zone, sim.clockSeconds)) cost[lane] += 20;
    }
  }
  for (const lane of LANES) cost[lane] += 0.1 * Math.abs(lane - sim.lane);

  let best = sim.lane;
  for (const lane of LANES) if (cost[lane] < cost[best]) best = lane;

  if (best !== sim.lane && sim.jumpTick === 0) return { lane: best > sim.lane ? 1 : -1 };
  if (nearestJump && nearestJump.lane === sim.lane && nearestJump.dist <= speed * 0.3 && nearestJump.dist >= speed * 0.08) {
    return { jump: true };
  }
  return {};
}

/** 套用一個動作 */
export function applyAction(sim: Sim, action: Action) {
  if (action.answer !== undefined) sim.answer(action.answer);
  if (action.lane) sim.moveLane(action.lane);
  if (action.jump) sim.jump();
}

/** 用自動駕駛跑完一局（測試用）。每 1/120 秒決定一次；突發事件馬上回答 */
export function playAutopilot(sim: Sim, maxTicks = 200 * TICKS_PER_SECOND) {
  for (let i = 0; i < maxTicks && !sim.over; i++) {
    applyAction(sim, autopilotAction(sim));
    sim.step();
  }
  return sim.result;
}

export { STEP };
