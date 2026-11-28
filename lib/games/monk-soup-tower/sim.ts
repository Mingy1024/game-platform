import { DECAL, SOUP, STEP, WALK } from "./config";
import { groundAt, inPuddle, walkable, type Layout, type Vec2 } from "./layouts";
import { sampleAt, type Path } from "./path";

/**
 * 一層的走路模擬（B5–B14）：和尚沿著路線走，碗裡的湯面用彈簧阻尼模擬傾斜。
 * 60 Hz 固定步進，只看「按住或放開」這一個輸入，所以同一條線、同一串按放時間一定得到同一個結果（B16）。
 *
 * 湯面 θ 是二維的：lat 是左右（轉彎），lon 是前後（起步、停下、坡度、階梯）。灑不灑看 |θ|。
 *   θ″ = −k·θ − c·θ′ + a
 *   a_lat = turnGain × v² × 曲率；a_lon = −accelGain × 加速度 + slopeGain × 坡度變化率 + 階梯震動
 * 滑區（水窪、湯漬）上 a × 2、c × 0.5，加速度減半（B5、B9）。
 */
export type Decal = { x: number; z: number; r: number; /** 這一層模擬時間（秒），冒熱氣 3 秒用 */ at: number };

export type WalkEvent =
  | { type: "step"; slip: boolean; x: number; z: number }
  | { type: "spill"; x: number; z: number; /** 這次灑出的方向（世界座標，單位向量） */ dx: number; dz: number }
  | { type: "decal"; decal: Decal }
  | { type: "fall"; x: number; z: number }
  | { type: "empty" }
  | { type: "arrive" };

export type FloorSim = {
  layout: Layout;
  path: Path;
  /** 走了多遠（路線上的累積長度） */
  s: number;
  v: number;
  /** 湯面傾斜（rad）與角速度 */
  lat: number;
  lon: number;
  latV: number;
  lonV: number;
  /** 剩下的湯（千分比，0～1000），整局共用一碗（A5） */
  soup: number;
  decals: Decal[];
  /** 這一層走了幾秒（只算模擬步） */
  time: number;
  slope: number;
  level: number;
  /** 階梯震動還剩幾秒 */
  kick: number;
  /** 下一步腳步聲的距離 */
  nextStep: number;
  spilling: boolean;
  done: "arrive" | "fall" | "empty" | null;
  events: WalkEvent[];
};

/** 腳步間距（單位） */
const STRIDE = 0.42;
/** 算坡度時往前後各看多遠 */
const SLOPE_PROBE = 0.15;

export function createFloorSim(layout: Layout, path: Path, soup: number): FloorSim {
  const start = sampleAt(path, 0);
  return {
    layout,
    path,
    s: 0,
    v: 0,
    lat: 0,
    lon: 0,
    latV: 0,
    lonV: 0,
    soup,
    decals: [],
    time: 0,
    slope: slopeAt(layout, path, 0),
    level: groundAt(layout, start).level,
    kick: 0,
    nextStep: STRIDE / 2,
    spilling: false,
    done: null,
    events: [],
  };
}

function slopeAt(layout: Layout, path: Path, s: number): number {
  const a = sampleAt(path, Math.max(0, s - SLOPE_PROBE));
  const b = sampleAt(path, Math.min(path.length, s + SLOPE_PROBE));
  const run = Math.hypot(b.x - a.x, b.z - a.z);
  if (run < 1e-6) return 0;
  return (groundAt(layout, b).height - groundAt(layout, a).height) / run;
}

/** 這一點是滑區嗎：雨水水窪或灑出的湯漬（B9、B11） */
export function slippery(sim: Pick<FloorSim, "layout" | "decals">, p: Vec2): boolean {
  if (sim.layout.puddles.some((q) => inPuddle(q, p))) return true;
  return sim.decals.some((d) => (p.x - d.x) ** 2 + (p.z - d.z) ** 2 <= d.r * d.r);
}

export const tilt = (sim: Pick<FloorSim, "lat" | "lon">): number => Math.hypot(sim.lat, sim.lon);

/** 前進一步（1/60 秒）。holding：玩家有沒有按住 */
export function stepFloor(sim: FloorSim, holding: boolean): void {
  if (sim.done) return;
  const dt = STEP;
  const here = sampleAt(sim.path, sim.s);
  const slip = slippery(sim, here);

  // ---- 速度（B5）：按住 0.25 秒到最高速，放開 0.2 秒停下；滑區加速度減半 ----
  const accel = (WALK.speed / WALK.accelSeconds) * (slip ? WALK.slipAccel : 1);
  const brake = (WALK.speed / WALK.stopSeconds) * (slip ? WALK.slipAccel : 1);
  const before = sim.v;
  sim.v = holding ? Math.min(WALK.speed, sim.v + accel * dt) : Math.max(0, sim.v - brake * dt);
  const dv = (sim.v - before) / dt;
  sim.s = Math.min(sim.path.length, sim.s + sim.v * dt);

  const at = sampleAt(sim.path, sim.s);
  const ground = groundAt(sim.layout, at);
  // 跨過一級階梯（斜坡上不算）
  if (ground.level !== sim.level && ground.level !== -1 && sim.level !== -1) sim.kick = SOUP.stepPulse;
  sim.level = ground.level;
  const slope = slopeAt(sim.layout, sim.path, sim.s);
  const slopeRate = (slope - sim.slope) / dt;
  sim.slope = slope;

  // ---- 湯面（B6–B10） ----
  const gainA = slip ? SOUP.slipA : 1;
  const c = SOUP.c * (slip ? SOUP.slipC : 1);
  let aLat = SOUP.turnGain * sim.v * sim.v * at.kappa;
  let aLon = -SOUP.accelGain * dv + SOUP.slopeGain * slopeRate;
  if (sim.kick > 0) {
    aLon += SOUP.stepKick;
    sim.kick = Math.max(0, sim.kick - dt);
  }
  aLat *= gainA;
  aLon *= gainA;
  sim.latV += (-SOUP.k * sim.lat - c * sim.latV + aLat) * dt;
  sim.lonV += (-SOUP.k * sim.lon - c * sim.lonV + aLon) * dt;
  sim.lat += sim.latV * dt;
  sim.lon += sim.lonV * dt;

  // ---- 灑出（B8、B11） ----
  const theta = tilt(sim);
  const over = theta - SOUP.thetaMax;
  if (over > 0 && sim.soup > 0) {
    sim.soup = Math.max(0, sim.soup - over * SOUP.spillPerRad * 10 * dt);
    // 灑出的方向：前後、左右的傾斜合成（左右以切線的法向為準）
    const nx = -at.tz;
    const nz = at.tx;
    const dx = (at.tx * sim.lon + nx * sim.lat) / theta;
    const dz = (at.tz * sim.lon + nz * sim.lat) / theta;
    if (!sim.spilling) sim.events.push({ type: "spill", x: at.x, z: at.z, dx, dz });
    sim.spilling = true;
    const near = sim.decals.some((d) => (at.x - d.x) ** 2 + (at.z - d.z) ** 2 < DECAL.spacing * DECAL.spacing);
    if (!near && sim.decals.length < DECAL.maxPerFloor) {
      const decal: Decal = { x: at.x, z: at.z, r: DECAL.radius, at: sim.time };
      sim.decals.push(decal);
      sim.events.push({ type: "decal", decal });
    }
  } else {
    sim.spilling = false;
  }

  sim.time += dt;

  // ---- 腳步 ----
  if (sim.s >= sim.nextStep) {
    sim.nextStep += STRIDE;
    sim.events.push({ type: "step", slip: slippery(sim, at), x: at.x, z: at.z });
  }

  // ---- 結束條件（B13–B15） ----
  if (!walkable(sim.layout, at)) {
    sim.done = "fall";
    sim.events.push({ type: "fall", x: at.x, z: at.z });
    return;
  }
  if (sim.soup <= 0) {
    sim.done = "empty";
    sim.events.push({ type: "empty" });
    return;
  }
  if (sim.s >= sim.path.length - 1e-9) {
    sim.done = "arrive";
    sim.events.push({ type: "arrive" });
  }
}

/** 取出並清空這段期間的事件 */
export function drainWalkEvents(sim: FloorSim): WalkEvent[] {
  const events = sim.events;
  sim.events = [];
  return events;
}

/** 和尚現在的位置、面向與腳下高度（場景用） */
export function monkPose(sim: FloorSim) {
  const at = sampleAt(sim.path, sim.s);
  return { x: at.x, z: at.z, tx: at.tx, tz: at.tz, y: groundAt(sim.layout, at).height };
}
