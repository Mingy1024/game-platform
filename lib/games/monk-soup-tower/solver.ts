import { DRAW, TOWER } from "./config";
import { walkable, type Layout, type Vec2 } from "./layouts";

/**
 * 在版型上找一條「寬度夠的路」（D5、D6）與自動駕駛用的路線。
 * 把地面切成 0.05 單位的格子，算每一格到最近的「不能走」的距離（離邊多遠），
 * 只允許走在離邊至少 0.42 的格子上（等於一條寬 0.85 的路），用 Dijkstra 找起點到樓梯口、
 * 而且偏好走在路中間的路線。找不到就代表這個版型沒有寬度夠的路。
 */
const CELL = 0.05;
const EXTENT = TOWER.rim + 0.6;
const SIZE = Math.round((EXTENT * 2) / CELL) + 1;
/** 路線要離邊多遠（半寬，比 0.85/2 少一點點，容許格子誤差） */
export const CLEARANCE = TOWER.minWidth / 2 - 0.01;

const toCell = (v: number) => Math.round((v + EXTENT) / CELL);
const toWorld = (i: number) => i * CELL - EXTENT;

export type Grid = { clear: Float32Array; size: number };

/** 每一格到最近不能走的格子的距離（兩次掃描的 chamfer 距離轉換） */
export function clearanceGrid(layout: Layout): Grid {
  const n = SIZE;
  const big = 1e6;
  const d = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) d[j * n + i] = walkable(layout, { x: toWorld(i), z: toWorld(j) }) ? big : 0;
  const a = CELL;
  const b = CELL * Math.SQRT2;
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      let v = d[k]!;
      if (v === 0) continue;
      if (i > 0) v = Math.min(v, d[k - 1]! + a);
      if (j > 0) v = Math.min(v, d[k - n]! + a);
      if (i > 0 && j > 0) v = Math.min(v, d[k - n - 1]! + b);
      if (i < n - 1 && j > 0) v = Math.min(v, d[k - n + 1]! + b);
      d[k] = v;
    }
  for (let j = n - 1; j >= 0; j--)
    for (let i = n - 1; i >= 0; i--) {
      const k = j * n + i;
      let v = d[k]!;
      if (v === 0) continue;
      if (i < n - 1) v = Math.min(v, d[k + 1]! + a);
      if (j < n - 1) v = Math.min(v, d[k + n]! + a);
      if (i < n - 1 && j < n - 1) v = Math.min(v, d[k + n + 1]! + b);
      if (i > 0 && j < n - 1) v = Math.min(v, d[k + n - 1]! + b);
      d[k] = v;
    }
  // 格子中心到邊界還差半格
  for (let k = 0; k < d.length; k++) if (d[k]! > 0) d[k] = d[k]! - CELL / 2;
  return { clear: d, size: n };
}

export const clearanceAt = (grid: Grid, p: Vec2): number => {
  const i = toCell(p.x);
  const j = toCell(p.z);
  if (i < 0 || j < 0 || i >= grid.size || j >= grid.size) return 0;
  return grid.clear[j * grid.size + i]!;
};

/** 最小堆（Dijkstra 用） */
class Heap {
  private keys: number[] = [];
  private vals: number[] = [];
  get size() {
    return this.keys.length;
  }
  push(key: number, val: number) {
    const k = this.keys;
    const v = this.vals;
    let i = k.length;
    k.push(key);
    v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p]! <= key) break;
      k[i] = k[p]!;
      v[i] = v[p]!;
      i = p;
    }
    k[i] = key;
    v[i] = val;
  }
  pop(): [number, number] {
    const k = this.keys;
    const v = this.vals;
    const top: [number, number] = [k[0]!, v[0]!];
    const lastK = k.pop()!;
    const lastV = v.pop()!;
    if (k.length > 0) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        let mk = lastK;
        if (l < k.length && k[l]! < mk) {
          m = l;
          mk = k[l]!;
        }
        if (r < k.length && k[r]! < mk) m = r;
        if (m === i) break;
        k[i] = k[m]!;
        v[i] = v[m]!;
        i = m;
      }
      k[i] = lastK;
      v[i] = lastV;
    }
    return top;
  }
}

/**
 * 從起點到樓梯口、離邊至少 CLEARANCE 的路線（格子中心的折線）；沒有這種路回傳 null。
 * 起點和終點本身可能離邊比較近（例如起點靠牆），所以兩端各容許一小段用比較小的寬度接上。
 */
export function findRoute(layout: Layout, grid: Grid = clearanceGrid(layout)): Vec2[] | null {
  const n = grid.size;
  const start = toCell(layout.start.x) + toCell(layout.start.z) * n;
  const goalI = toCell(layout.goal.x);
  const goalJ = toCell(layout.goal.z);
  const goal = goalI + goalJ * n;
  const dist = new Float64Array(n * n).fill(Infinity);
  const prev = new Int32Array(n * n).fill(-1);
  const heap = new Heap();
  dist[start] = 0;
  heap.push(0, start);
  const near = (k: number, c: number) => {
    const i = k % n;
    const j = (k - i) / n;
    return Math.hypot(toWorld(i) - toWorld(c % n), toWorld(j) - toWorld((c - (c % n)) / n));
  };
  const moves = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [-1, -1, Math.SQRT2],
  ] as const;
  while (heap.size > 0) {
    const [d, k] = heap.pop();
    if (d > dist[k]!) continue;
    if (k === goal) break;
    const i = k % n;
    const j = (k - i) / n;
    for (const [di, dj, len] of moves) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
      const nk = nj * n + ni;
      const clear = grid.clear[nk]!;
      const endZone = near(nk, start) < 0.5 || near(nk, goal) < 0.5;
      if (clear < (endZone ? 0.2 : CLEARANCE)) continue;
      // 偏好走在路中間：離邊越近成本越高
      const cost = len * CELL * (1 + 1.6 * Math.max(0, 0.9 - clear));
      const nd = d + cost;
      if (nd < dist[nk]!) {
        dist[nk] = nd;
        prev[nk] = k;
        heap.push(nd, nk);
      }
    }
  }
  if (!Number.isFinite(dist[goal]!)) return null;
  const cells: number[] = [];
  for (let k = goal; k !== -1; k = prev[k]!) cells.push(k);
  cells.reverse();
  return cells.map((k) => ({ x: toWorld(k % n), z: toWorld((k - (k % n)) / n) }));
}

/**
 * 自動駕駛與測試用的「標準畫法」：找到的路線每隔幾格取一點，起點改成和尚的位置、終點改成樓梯口中心。
 * 這就是玩家用手指畫一條漂亮的線會得到的原始點。
 */
export function idealLine(layout: Layout): Vec2[] | null {
  const route = findRoute(layout);
  if (!route) return null;
  const every = Math.max(1, Math.round(DRAW.resample / CELL / 2));
  const points = route.filter((_, i) => i % every === 0);
  points[0] = { ...layout.start };
  points.push({ ...layout.goal });
  return points;
}
