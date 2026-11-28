import { DRAW } from "./config";
import type { Vec2 } from "./layouts";

/**
 * 路線：玩家一筆畫出來的線，放開後自動平滑（B3）。
 * 1. 原始點沿著線每隔 0.3 單位取一點（resample）。
 * 2. 用 centripetal Catmull-Rom 把取樣點連成曲線，再細分成每 0.05 單位一點，給模擬用。
 * 3. 每一點記下累積長度、切線方向與曲率（轉彎的急緩，驅動湯面，B7）。
 */
export type Path = {
  /** 細分後的點 */
  xs: Float64Array;
  zs: Float64Array;
  /** 每一點的累積長度 */
  s: Float64Array;
  /** 每一點的曲率（帶正負：左轉正、右轉負） */
  kappa: Float64Array;
  length: number;
  /** 平滑前的取樣點（每 0.3 單位一點），畫面上畫的就是這條線平滑後的樣子 */
  anchors: Vec2[];
};

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);

/** 沿著折線每隔 step 取一點；保留起點和終點 */
export function resample(points: Vec2[], step: number = DRAW.resample): Vec2[] {
  if (points.length === 0) return [];
  const out: Vec2[] = [points[0]!];
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const seg = dist(a, b);
    if (seg === 0) continue;
    let t = step - carry;
    while (t <= seg) {
      out.push({ x: a.x + ((b.x - a.x) * t) / seg, z: a.z + ((b.z - a.z) * t) / seg });
      t += step;
    }
    carry = seg - (t - step);
  }
  const last = points[points.length - 1]!;
  const tail = out[out.length - 1]!;
  // 最後一段太短（不到半格）就把最後一個取樣點換成終點，不然終點附近會出現急轉
  if (out.length > 1 && dist(tail, last) < step / 2) out[out.length - 1] = last;
  else if (dist(tail, last) > 1e-9) out.push(last);
  return out;
}

/** centripetal Catmull-Rom 的一段（p1 到 p2），t 從 0 到 1 */
function catmull(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const alpha = 0.5;
  const tj = (a: Vec2, b: Vec2, ti: number) => ti + Math.max(1e-6, dist(a, b) ** alpha);
  const t0 = 0;
  const t1 = tj(p0, p1, t0);
  const t2 = tj(p1, p2, t1);
  const t3 = tj(p2, p3, t2);
  const u = t1 + (t2 - t1) * t;
  const lerp = (a: Vec2, b: Vec2, ta: number, tb: number) => {
    const w = (u - ta) / (tb - ta);
    return { x: a.x + (b.x - a.x) * w, z: a.z + (b.z - a.z) * w };
  };
  const a1 = lerp(p0, p1, t0, t1);
  const a2 = lerp(p1, p2, t1, t2);
  const a3 = lerp(p2, p3, t2, t3);
  const b1 = lerp(a1, a2, t0, t2);
  const b2 = lerp(a2, a3, t1, t3);
  return lerp(b1, b2, t1, t2);
}

/** 曲率的平滑半徑（單位）：取前後各 0.15 單位的方向變化 */
const KAPPA_WINDOW = 0.15;

/** 把原始的畫線點變成平滑的路線 */
export function buildPath(raw: Vec2[]): Path {
  const anchors = resample(raw);
  const fine: Vec2[] = [];
  if (anchors.length === 1) fine.push(anchors[0]!);
  for (let i = 0; i < anchors.length - 1; i++) {
    const p1 = anchors[i]!;
    const p2 = anchors[i + 1]!;
    // 兩端用鏡射補一個點，曲線才會剛好通過起點與終點
    const p0 = anchors[i - 1] ?? { x: 2 * p1.x - p2.x, z: 2 * p1.z - p2.z };
    const p3 = anchors[i + 2] ?? { x: 2 * p2.x - p1.x, z: 2 * p2.z - p1.z };
    const n = Math.max(1, Math.ceil(dist(p1, p2) / DRAW.fine));
    for (let k = 0; k < n; k++) fine.push(catmull(p0, p1, p2, p3, k / n));
  }
  if (anchors.length > 1) fine.push(anchors[anchors.length - 1]!);

  const count = fine.length;
  const xs = new Float64Array(count);
  const zs = new Float64Array(count);
  const s = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    xs[i] = fine[i]!.x;
    zs[i] = fine[i]!.z;
    if (i > 0) s[i] = s[i - 1]! + Math.hypot(xs[i]! - xs[i - 1]!, zs[i]! - zs[i - 1]!);
  }
  const length = count > 0 ? s[count - 1]! : 0;
  const kappa = new Float64Array(count);
  // 方向角（展開成連續的，跨過 ±π 不跳）
  const heading = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    const a = Math.max(0, i - 1);
    const b = Math.min(count - 1, i + 1);
    let angle = Math.atan2(zs[b]! - zs[a]!, xs[b]! - xs[a]!);
    if (i > 0) {
      const prev = heading[i - 1]!;
      while (angle - prev > Math.PI) angle -= 2 * Math.PI;
      while (angle - prev < -Math.PI) angle += 2 * Math.PI;
    }
    heading[i] = angle;
  }
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < count; i++) {
    while (lo < i && s[i]! - s[lo]! > KAPPA_WINDOW) lo++;
    while (hi < count - 1 && s[hi]! - s[i]! < KAPPA_WINDOW) hi++;
    const ds = s[hi]! - s[lo]!;
    // 俯視的 (x, z) 是左手座標：z 往畫面下方。這裡的正負只用來區分左右，大小才是重點
    kappa[i] = ds > 1e-6 ? (heading[hi]! - heading[lo]!) / ds : 0;
  }
  return { xs, zs, s, kappa, length, anchors };
}

/** 路線上第一個累積長度 ≥ at 的索引 */
function indexAt(path: Path, at: number): number {
  let lo = 0;
  let hi = path.s.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (path.s[mid]! < at) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export type PathSample = { x: number; z: number; tx: number; tz: number; kappa: number };

/** 路線上累積長度 at 的位置、單位切線與曲率 */
export function sampleAt(path: Path, at: number): PathSample {
  const n = path.s.length;
  if (n === 0) return { x: 0, z: 0, tx: 1, tz: 0, kappa: 0 };
  if (n === 1) return { x: path.xs[0]!, z: path.zs[0]!, tx: 1, tz: 0, kappa: 0 };
  const clamped = Math.max(0, Math.min(path.length, at));
  const i = Math.max(1, indexAt(path, clamped));
  const s0 = path.s[i - 1]!;
  const s1 = path.s[i]!;
  const w = s1 > s0 ? (clamped - s0) / (s1 - s0) : 0;
  const x = path.xs[i - 1]! + (path.xs[i]! - path.xs[i - 1]!) * w;
  const z = path.zs[i - 1]! + (path.zs[i]! - path.zs[i - 1]!) * w;
  const dx = path.xs[i]! - path.xs[i - 1]!;
  const dz = path.zs[i]! - path.zs[i - 1]!;
  const len = Math.hypot(dx, dz) || 1;
  const kappa = path.kappa[i - 1]! + (path.kappa[i]! - path.kappa[i - 1]!) * w;
  return { x, z, tx: dx / len, tz: dz / len, kappa };
}

/** 一條線的起點、終點（給起終點檢查用） */
export const firstPoint = (points: Vec2[]): Vec2 | undefined => points[0];
export const lastPoint = (points: Vec2[]): Vec2 | undefined => points[points.length - 1];
