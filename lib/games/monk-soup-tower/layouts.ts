import { TOWER } from "./config";

/**
 * 五層塔的手工版型（D1、D2、D4）與地面判定（B9、B10、B13）。
 * 座標是場景單位、俯視的 (x, z)：塔身是 |x|、|z| < 3 的方塊，迴廊在 3～5 之間。
 * 不翻轉時，和尚從前廊（z ≈ 4）出發往 +x 走，轉進右廊（x ≈ 4）往 −z 走到樓梯口 (4.0, −2.2)。
 * 每層的判定都用縮放 1（外觀才隨樓層縮小），所以版型可以直接拿來算。
 * 純邏輯，場景（app/games/monk-soup-tower/）照這份資料建模，判定和畫面才會一致。
 */
export type Vec2 = { x: number; z: number };
export type Rect = { x0: number; x1: number; z0: number; z1: number };
/** 斜放的橫樑：中心、長（沿本身的 z 軸）、寬、繞 y 軸轉的角度（和 three.js 的 rotation.y 相同） */
export type Diag = { cx: number; cz: number; len: number; w: number; ry: number };
export type Beam = ({ kind: "rect" } & Rect) | ({ kind: "diag" } & Diag);
/** 雨水水窪：橢圓，rx 沿 (cos rot, −sin rot) 方向，rz 垂直於它（和 rotation.y 相同的轉法） */
export type Puddle = { x: number; z: number; rx: number; rz: number; rot: number };
/** 架高平台的一端：三級階梯或斜坡 */
export type Approach = { kind: "steps" | "ramp"; len: number };
/**
 * 架高平台（第 2 層）。axis 是沿哪個軸走；top 是平台頂面在那個軸上的範圍；
 * cross 是另一個軸的範圍（平台的寬）；low／high 是頂面前、後兩端的接法（low 在座標小的那一端）。
 */
export type Platform = { axis: "x" | "z"; top: [number, number]; cross: [number, number]; low: Approach; high: Approach };
/** 欄杆缺口：side 0 前（z = 5）、1 右（x = 5）、2 後、3 左；a、b 是沿著那一邊的座標範圍 */
export type RailGap = { side: 0 | 1 | 2 | 3; a: number; b: number };

export type Layout = {
  id: string;
  floor: number;
  holes: Rect[];
  beams: Beam[];
  puddles: Puddle[];
  gaps: RailGap[];
  platform: Platform | null;
  start: Vec2;
  goal: Vec2;
  /** 第 4 層：外側（前、右）完全沒有欄杆 */
  noOuterRail: boolean;
  flipped: boolean;
};

type LayoutDef = Omit<Layout, "goal" | "flipped" | "noOuterRail" | "gaps" | "platform" | "start"> & {
  gaps?: RailGap[];
  platform?: Platform;
  start?: Vec2;
  noOuterRail?: boolean;
};

const rect = (x0: number, x1: number, z0: number, z1: number): Rect => ({ x0, x1, z0, z1 });
const beam = (x0: number, x1: number, z0: number, z1: number): Beam => ({ kind: "rect", x0, x1, z0, z1 });
const diag = (cx: number, cz: number, len: number, ry: number, w: number = TOWER.minWidth): Beam => ({ kind: "diag", cx, cz, len, w, ry });
const puddle = (x: number, z: number, rx: number, rz: number, rot = 0): Puddle => ({ x, z, rx, rz, rot });
const DIAG = (3 * Math.PI) / 4;

/**
 * 每層 4 種版型；第一種是代表版型（固定關卡用，也是設計稿 C1 畫的那一種）。
 * 同一層的版型用同一類元素（D4）：1 水窪、2 階梯與斜坡、3 斷廊橫樑、4 斜跨橫樑且外側沒有欄杆、5 L 形橫樑。
 */
const DEFS: LayoutDef[][] = [
  // 第 1 層：完整迴廊、一個水窪
  [
    { id: "1a", floor: 1, holes: [], beams: [], puddles: [puddle(2.6, 3.7, 0.7, 0.42, 0.2)] },
    { id: "1b", floor: 1, holes: [], beams: [], puddles: [puddle(4.0, 4.1, 0.6, 0.45, 0.6)] },
    { id: "1c", floor: 1, holes: [], beams: [], puddles: [puddle(4.2, 0.6, 0.45, 0.7, 0.1)] },
    { id: "1d", floor: 1, holes: [], beams: [], puddles: [puddle(4.3, -0.9, 0.4, 0.6, -0.2)] },
  ],
  // 第 2 層：右廊中段架高，階梯與斜坡；兩個水窪；正面欄杆少一段
  [
    {
      id: "2a",
      floor: 2,
      holes: [],
      beams: [],
      platform: { axis: "z", top: [-0.6, 1.4], cross: [3.05, 4.95], low: { kind: "ramp", len: 2.0 }, high: { kind: "steps", len: 0.9 } },
      puddles: [puddle(2.4, 4.3, 0.5, 0.35), puddle(4.2, 3.8, 0.4, 0.5, 0.3)],
      gaps: [{ side: 0, a: 1.5, b: 2.5 }],
    },
    {
      id: "2b",
      floor: 2,
      holes: [],
      beams: [],
      platform: { axis: "z", top: [-1.2, 0.6], cross: [3.05, 4.95], low: { kind: "steps", len: 0.9 }, high: { kind: "ramp", len: 2.0 } },
      puddles: [puddle(1.6, 3.5, 0.45, 0.3, 0.2), puddle(3.6, 4.4, 0.4, 0.3)],
      gaps: [{ side: 0, a: 2.5, b: 3.5 }],
    },
    {
      id: "2c",
      floor: 2,
      holes: [],
      beams: [],
      platform: { axis: "z", top: [-0.9, 0.9], cross: [3.05, 4.95], low: { kind: "steps", len: 0.9 }, high: { kind: "steps", len: 0.9 } },
      puddles: [puddle(2.8, 4.2, 0.5, 0.32), puddle(4.4, 2.6, 0.35, 0.4)],
      gaps: [{ side: 0, a: 1.0, b: 2.0 }],
    },
    {
      id: "2d",
      floor: 2,
      holes: [],
      beams: [],
      platform: { axis: "z", top: [-1.4, 0.2], cross: [3.05, 4.95], low: { kind: "ramp", len: 1.0 }, high: { kind: "steps", len: 0.9 } },
      puddles: [puddle(3.2, 3.6, 0.4, 0.3, 0.4), puddle(4.3, 2.0, 0.35, 0.45)],
      gaps: [{ side: 0, a: 2.0, b: 3.0 }],
    },
  ],
  // 第 3 層：迴廊斷掉，只剩一根 0.85 寬的橫樑；兩個水窪；正面欄杆缺口
  [
    {
      id: "3a",
      floor: 3,
      holes: [rect(3, 5.1, -1.4, 1.7)],
      beams: [beam(4.1, 4.95, -1.55, 1.85)],
      puddles: [puddle(2.7, 3.55, 0.6, 0.38, 0.3), puddle(3.85, 2.3, 0.4, 0.5, -0.4)],
      gaps: [{ side: 0, a: 0.5, b: 2.5 }],
      start: { x: 1.2, z: 4.0 },
    },
    {
      id: "3b",
      floor: 3,
      holes: [rect(3, 5.1, -1.2, 1.5)],
      beams: [beam(3.05, 3.9, -1.35, 1.65)],
      puddles: [puddle(2.2, 4.4, 0.5, 0.32), puddle(4.4, 2.4, 0.35, 0.45)],
      gaps: [{ side: 0, a: 2.0, b: 3.5 }],
      start: { x: 1.2, z: 4.0 },
    },
    {
      id: "3c",
      floor: 3,
      holes: [rect(1.9, 3.6, 3.0, 5.1)],
      beams: [beam(1.75, 3.75, 4.1, 4.95)],
      puddles: [puddle(4.2, 1.8, 0.4, 0.5), puddle(4.3, -0.6, 0.35, 0.45, 0.2)],
    },
    {
      id: "3d",
      floor: 3,
      holes: [rect(3, 5.1, 1.0, 2.6), rect(3, 5.1, -1.8, -0.4)],
      beams: [beam(4.1, 4.95, 0.85, 2.75), beam(3.05, 3.9, -1.95, -0.25)],
      puddles: [puddle(2.5, 4.0, 0.5, 0.35), puddle(4.0, 0.3, 0.35, 0.28)],
      gaps: [{ side: 0, a: 2.5, b: 3.5 }],
      start: { x: 1.2, z: 4.0 },
    },
  ],
  // 第 4 層：轉角或迴廊塌掉，一根斜跨的橫樑；外側沒有欄杆；橫樑前後各一個水窪
  [
    {
      id: "4a",
      floor: 4,
      holes: [rect(2.4, 5.1, 3.0, 5.1), rect(3.0, 5.1, 2.4, 3.0)],
      beams: [diag(3.35, 3.35, 3.4, DIAG)],
      puddles: [puddle(1.0, 3.5, 0.4, 0.3), puddle(4.4, 0.4, 0.35, 0.5, 0.2)],
      noOuterRail: true,
    },
    {
      id: "4b",
      floor: 4,
      holes: [rect(3, 5.1, -1.0, 1.4)],
      beams: [diag(4.0, 0.2, 3.5, Math.atan2(0.8, -3.0))],
      puddles: [puddle(4.0, 2.3, 0.3, 0.4), puddle(4.4, -1.55, 0.3, 0.25)],
      noOuterRail: true,
    },
    {
      id: "4c",
      floor: 4,
      holes: [rect(1.8, 4.0, 3.0, 5.1)],
      beams: [diag(2.8, 4.0, 3.6, Math.atan2(2.8, 1.0))],
      puddles: [puddle(4.5, 3.6, 0.3, 0.3), puddle(4.3, 0.5, 0.35, 0.5)],
      noOuterRail: true,
    },
    {
      id: "4d",
      floor: 4,
      holes: [rect(2.5, 5.1, 3.0, 5.1), rect(3.0, 5.1, 2.3, 3.0)],
      beams: [diag(3.5, 3.4, 3.6, DIAG)],
      puddles: [puddle(1.2, 3.6, 0.35, 0.3), puddle(4.2, 0.0, 0.35, 0.5)],
      noOuterRail: true,
    },
  ],
  // 第 5 層：前廊和右廊只剩 L 形橫樑，橫樑上有小水窪
  [
    {
      id: "5a",
      floor: 5,
      holes: [rect(1.2, 5.1, 3.0, 5.1), rect(3.0, 5.1, -1.7, 3.0)],
      beams: [beam(1.1, 4.8, 4.05, 4.9), beam(3.95, 4.8, -1.85, 4.9)],
      puddles: [puddle(2.6, 4.475, 0.28, 0.2), puddle(4.375, 1.0, 0.2, 0.35)],
      start: { x: 0.7, z: 4.0 },
    },
    {
      id: "5b",
      floor: 5,
      holes: [rect(1.2, 5.1, 3.0, 5.1), rect(3.0, 5.1, -1.7, 3.0)],
      beams: [beam(1.1, 3.9, 3.05, 3.9), beam(3.05, 3.9, -1.85, 3.9)],
      puddles: [puddle(2.3, 3.475, 0.25, 0.2), puddle(3.475, 0.5, 0.2, 0.3)],
      start: { x: 0.7, z: 4.0 },
    },
    {
      id: "5c",
      floor: 5,
      holes: [rect(1.2, 5.1, 3.0, 5.1), rect(3.0, 5.1, -1.7, 3.0)],
      beams: [beam(1.1, 4.8, 4.05, 4.9), beam(3.05, 3.9, -1.85, 4.9)],
      puddles: [puddle(2.2, 4.475, 0.25, 0.2), puddle(3.475, 1.6, 0.2, 0.3)],
      start: { x: 0.7, z: 4.0 },
    },
    {
      id: "5d",
      floor: 5,
      holes: [rect(1.2, 5.1, 3.0, 5.1), rect(3.0, 5.1, -1.7, 3.0)],
      beams: [beam(1.1, 4.8, 3.05, 3.9), beam(3.95, 4.8, -1.85, 3.9)],
      puddles: [puddle(2.0, 3.475, 0.25, 0.2), puddle(4.375, -0.5, 0.2, 0.3)],
      start: { x: 0.7, z: 4.0 },
    },
  ],
];

const DEFAULT_START: Vec2 = { x: 1.0, z: 4.0 };

/** 洞碰到外緣的地方自動拿掉欄杆（不然欄杆會懸在半空中） */
function holeGaps(holes: Rect[]): RailGap[] {
  const gaps: RailGap[] = [];
  for (const h of holes) {
    if (h.z1 >= TOWER.rim) gaps.push({ side: 0, a: h.x0, b: h.x1 });
    if (h.x1 >= TOWER.rim) gaps.push({ side: 1, a: h.z0, b: h.z1 });
  }
  return gaps;
}

function build(def: LayoutDef): Layout {
  const noOuterRail = def.noOuterRail ?? false;
  const outer: RailGap[] = noOuterRail
    ? [
        { side: 0, a: -TOWER.rim - 1, b: TOWER.rim + 1 },
        { side: 1, a: -TOWER.rim - 1, b: TOWER.rim + 1 },
      ]
    : [];
  return {
    id: def.id,
    floor: def.floor,
    holes: def.holes,
    beams: def.beams,
    puddles: def.puddles,
    platform: def.platform ?? null,
    gaps: [...(def.gaps ?? []), ...holeGaps(def.holes), ...outer],
    start: def.start ?? DEFAULT_START,
    goal: { x: TOWER.goal[0], z: TOWER.goal[1] },
    noOuterRail,
    flipped: false,
  };
}

export const LAYOUTS: Layout[][] = DEFS.map((floor) => floor.map(build));

/** 某一層的所有版型（第 1～5 層） */
export const layoutsOf = (floor: number): Layout[] => LAYOUTS[floor - 1] ?? [];

export function layoutById(id: string): Layout | undefined {
  for (const floor of LAYOUTS) for (const layout of floor) if (layout.id === id) return layout;
  return undefined;
}

// ---- 左右翻轉（x → −x）----

const flipRect = (r: Rect): Rect => ({ x0: -r.x1, x1: -r.x0, z0: r.z0, z1: r.z1 });
const flipSide = (side: RailGap["side"]): RailGap["side"] => (side === 1 ? 3 : side === 3 ? 1 : side);

export function flipLayout(layout: Layout): Layout {
  if (layout.flipped) return layout;
  const p = layout.platform;
  return {
    ...layout,
    flipped: true,
    holes: layout.holes.map(flipRect),
    beams: layout.beams.map((b) => (b.kind === "rect" ? { kind: "rect" as const, ...flipRect(b) } : { ...b, cx: -b.cx, ry: -b.ry })),
    puddles: layout.puddles.map((q) => ({ ...q, x: -q.x, rot: -q.rot })),
    gaps: layout.gaps.map((g) => (g.side === 0 || g.side === 2 ? { side: g.side, a: -g.b, b: -g.a } : { ...g, side: flipSide(g.side) })),
    platform: !p
      ? null
      : p.axis === "z"
        ? { ...p, cross: [-p.cross[1], -p.cross[0]] }
        : { ...p, top: [-p.top[1], -p.top[0]], low: p.high, high: p.low },
    start: { x: -layout.start.x, z: layout.start.z },
    goal: { x: -layout.goal.x, z: layout.goal.z },
  };
}

// ---- 地面判定 ----

const inRect = (r: Rect, p: Vec2) => p.x >= r.x0 && p.x <= r.x1 && p.z >= r.z0 && p.z <= r.z1;

/** 點在斜放橫樑的本身座標（lx 沿寬、lz 沿長） */
function diagLocal(b: Diag, p: Vec2) {
  const dx = p.x - b.cx;
  const dz = p.z - b.cz;
  const c = Math.cos(b.ry);
  const s = Math.sin(b.ry);
  return { lx: dx * c - dz * s, lz: dx * s + dz * c };
}

export function inBeam(b: Beam, p: Vec2): boolean {
  if (b.kind === "rect") return inRect(b, p);
  const { lx, lz } = diagLocal(b, p);
  return Math.abs(lx) <= b.w / 2 && Math.abs(lz) <= b.len / 2;
}

/** 迴廊（塔身外、外緣內） */
export function inRing(p: Vec2): boolean {
  const ax = Math.abs(p.x);
  const az = Math.abs(p.z);
  if (ax > TOWER.rim || az > TOWER.rim) return false;
  return !(ax < TOWER.core && az < TOWER.core);
}

/** 可走的地面（B13）：迴廊扣掉洞，加上橫樑。欄杆不擋人，也不是地面 */
export function walkable(layout: Layout, p: Vec2): boolean {
  if (layout.beams.some((b) => inBeam(b, p))) return true;
  return inRing(p) && !layout.holes.some((h) => inRect(h, p));
}

export function inPuddle(q: Puddle, p: Vec2): boolean {
  const dx = p.x - q.x;
  const dz = p.z - q.z;
  const c = Math.cos(q.rot);
  const s = Math.sin(q.rot);
  const a = dx * c - dz * s;
  const b = dx * s + dz * c;
  return (a / q.rx) ** 2 + (b / q.rz) ** 2 <= 1;
}

/** 點在平台的哪一段：along 是沿著走的座標，onCross 是在平台寬度內 */
function platformAt(p: Platform, point: Vec2) {
  const along = p.axis === "z" ? point.z : point.x;
  const cross = p.axis === "z" ? point.x : point.z;
  return { along, onCross: cross >= p.cross[0] && cross <= p.cross[1] };
}

const STEPS = 3;

/**
 * 地面高度與階梯級數。級數：地面 0、階梯 1～3、平台頂 3；斜坡上是 −1（斜坡不算階梯，經過不震）。
 * 級數改變（而且兩邊都不是 −1）就是跨過一級階梯（B10）。
 */
export function groundAt(layout: Layout, point: Vec2): { height: number; level: number } {
  const p = layout.platform;
  if (!p) return { height: 0, level: 0 };
  const { along, onCross } = platformAt(p, point);
  if (!onCross) return { height: 0, level: 0 };
  const H = TOWER.platformHeight;
  const [t0, t1] = p.top;
  if (along >= t0 && along <= t1) return { height: H, level: STEPS };
  const side = along < t0 ? p.low : p.high;
  const d = along < t0 ? t0 - along : along - t1;
  if (d > side.len) return { height: 0, level: 0 };
  if (side.kind === "ramp") return { height: H * (1 - d / side.len), level: -1 };
  // 三級階梯：靠平台的那一級最高
  const i = Math.min(STEPS - 1, Math.floor(d / (side.len / STEPS)));
  return { height: (H * (STEPS - i)) / STEPS, level: STEPS - i };
}

/** 版型的每一個元素都在這一層嗎（測試用的完整清單） */
export const allLayouts = (): Layout[] => LAYOUTS.flat().flatMap((layout) => [layout, flipLayout(layout)]);
