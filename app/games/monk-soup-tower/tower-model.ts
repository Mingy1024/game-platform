import * as THREE from "three";
import { TOWER } from "@/lib/games/monk-soup-tower/config";
import { groundAt, type Layout, type RailGap } from "@/lib/games/monk-soup-tower/layouts";

/**
 * 和尚端湯上塔的 3D 模型：塔、迴廊、欄杆、屋簷、樹林、和尚與湯碗，全部程式建模（H2），不載入模型檔與貼圖。
 * 同一類的方塊合併成一個 InstancedMesh（一種材質一次繪製），讓每個畫面的 draw call 壓在 100 以下（H6）。
 * 判定用的版型資料在 lib/games/monk-soup-tower/layouts.ts；這裡照它建模，畫面和判定才會一致。
 * 和設計稿的渲染器（.scratch/monk-soup-tower/render/scene.js）是同一套做法。
 */
export const SKY = 0xcfe2dd;
const WOOD = [0xb98a5c, 0xb07f52, 0xc19366, 0xa9784c];
const LACQUER = 0xa8372c;

type Box = { x: number; y: number; z: number; sx: number; sy: number; sz: number; color: number; rx?: number; ry?: number };
type Kind = "wood" | "lacquer" | "wall" | "dark" | "stone";
const KINDS: Record<Kind, { roughness: number; cast: boolean }> = {
  wood: { roughness: 0.8, cast: false },
  // 只有欄杆與柱子（朱漆）投影：陰影只給和尚和欄杆（第 12 題）
  lacquer: { roughness: 0.55, cast: true },
  wall: { roughness: 0.95, cast: false },
  dark: { roughness: 0.9, cast: false },
  stone: { roughness: 1, cast: false },
};

/** 收集方塊，最後每一類合併成一個 InstancedMesh */
class Boxes {
  readonly items: Record<Kind, Box[]> = { wood: [], lacquer: [], wall: [], dark: [], stone: [] };
  add(kind: Kind, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: number, ry = 0, rx = 0) {
    this.items[kind].push({ x, y, z, sx, sy, sz, color, ry, rx });
  }
  build(group: THREE.Group, shadows: boolean) {
    const matrix = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const euler = new THREE.Euler();
    const color = new THREE.Color();
    const box = new THREE.BoxGeometry(1, 1, 1);
    for (const kind of Object.keys(this.items) as Kind[]) {
      const items = this.items[kind];
      if (items.length === 0) continue;
      const mesh = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ roughness: KINDS[kind].roughness }), items.length);
      items.forEach((it, i) => {
        quat.setFromEuler(euler.set(it.rx ?? 0, it.ry ?? 0, 0));
        mesh.setMatrixAt(i, matrix.compose(pos.set(it.x, it.y, it.z), quat, scale.set(it.sx, it.sy, it.sz)));
        mesh.setColorAt(i, color.set(it.color));
      });
      mesh.castShadow = shadows && KINDS[kind].cast;
      mesh.receiveShadow = shadows;
      group.add(mesh);
    }
  }
}

type Hole = { x0: number; x1: number; z0: number; z1: number };

/** 把一條木板依洞切成幾段 */
function segments(a: number, b: number, holes: Hole[], dir: "x" | "z", across: number): [number, number][] {
  let parts: [number, number][] = [[a, b]];
  for (const h of holes) {
    const inside = dir === "x" ? across > h.z0 && across < h.z1 : across > h.x0 && across < h.x1;
    if (!inside) continue;
    const h0 = dir === "x" ? h.x0 : h.z0;
    const h1 = dir === "x" ? h.x1 : h.z1;
    const next: [number, number][] = [];
    for (const [p, q] of parts) {
      if (h1 <= p || h0 >= q) {
        next.push([p, q]);
        continue;
      }
      if (h0 > p) next.push([p, h0]);
      if (h1 < q) next.push([h1, q]);
    }
    parts = next;
  }
  return parts.filter(([p, q]) => q - p > 0.05);
}

/** 欄杆：沿四邊每 1 單位一根柱子，上下兩道橫木；缺口的地方不放 */
function railing(boxes: Boxes, y: number, s: number, gaps: RailGap[]) {
  const R = TOWER.rim * s;
  const H = 0.95;
  const sides = [
    { fixed: "z", v: R - 0.08, from: -R, to: R },
    { fixed: "x", v: R - 0.08, from: R, to: -R },
    { fixed: "z", v: -R + 0.08, from: R, to: -R },
    { fixed: "x", v: -R + 0.08, from: -R, to: R },
  ] as const;
  sides.forEach((side, index) => {
    const len = Math.abs(side.to - side.from);
    const dir = Math.sign(side.to - side.from);
    const step = 1.0 * s;
    const count = Math.round(len / step);
    const blocked = (t: number) => gaps.some((g) => g.side === index && t > g.a * s - 0.01 && t < g.b * s + 0.01);
    for (let k = 0; k <= count; k++) {
      const t = side.from + dir * k * step;
      if (blocked(t)) continue;
      const px = side.fixed === "z" ? t : side.v;
      const pz = side.fixed === "z" ? side.v : t;
      boxes.add("lacquer", px, y + H / 2, pz, 0.13, H, 0.13, LACQUER);
      if (k === count) continue;
      const t2 = t + dir * step;
      if (blocked(t2) || blocked((t + t2) / 2)) continue;
      const mx = side.fixed === "z" ? (t + t2) / 2 : side.v;
      const mz = side.fixed === "z" ? side.v : (t + t2) / 2;
      const sx = side.fixed === "z" ? step : 0.09;
      const sz = side.fixed === "z" ? 0.09 : step;
      boxes.add("lacquer", mx, y + H, mz, sx + (side.fixed === "z" ? 0.1 : 0.06), 0.1, sz + (side.fixed === "z" ? 0.06 : 0.1), 0x9c3128);
      boxes.add("lacquer", mx, y + 0.35, mz, sx, 0.06, sz, 0x8e2b23);
    }
  });
}

/** 一層：塔身、柱子、迴廊木板（扣掉洞）、橫樑、斷板、欄杆、架高平台 */
function level(boxes: Boxes, y: number, s: number, layout: Layout | null) {
  const C = TOWER.core * s;
  const R = TOWER.rim * s;
  const T = 0.25;
  boxes.add("wall", 0, y + 1.3, 0, C * 2, 2.6, C * 2, 0xeee4cf);
  boxes.add("dark", 0, y + 2.66, 0, C * 2 + 0.5, 0.12, C * 2 + 0.5, 0x6b4630);
  for (const side of [1, -1]) {
    boxes.add("dark", -0.6 * s, y + 1.1, side * (C + 0.01), 1.3 * s, 2.0, 0.05, 0x5a3322);
    boxes.add("dark", side * (C + 0.01), y + 1.35, -1.6 * s, 0.05, 1.0, 1.2 * s, 0x5a3322);
    boxes.add("dark", side * (C + 0.01), y + 1.35, 1.4 * s, 0.05, 1.0, 1.2 * s, 0x5a3322);
    boxes.add("dark", 1.9 * s, y + 1.35, side * (C + 0.01), 1.2 * s, 1.0, 0.05, 0x5a3322);
  }
  for (const px of [-C, 0, C])
    for (const pz of [-C, 0, C]) {
      if (px === 0 && pz === 0) continue;
      boxes.add("lacquer", px, y + 1.3, pz, 0.36, 2.6, 0.36, LACQUER);
    }
  for (const side of [1, -1]) {
    boxes.add("lacquer", 0, y + 2.5, side * (C + 0.05), C * 2 + 0.4, 0.22, 0.2, 0x9c3128);
    boxes.add("lacquer", side * (C + 0.05), y + 2.5, 0, 0.2, 0.22, C * 2 + 0.4, 0x9c3128);
  }
  const holes = (layout?.holes ?? []).map((h) => ({ x0: h.x0 * s, x1: h.x1 * s, z0: h.z0 * s, z1: h.z1 * s }));
  const rects: [number, number, number, number, "x" | "z"][] = [
    [-R, R, C, R, "x"],
    [-R, R, -R, -C, "x"],
    [-R, -C, -C, C, "z"],
    [C, R, -C, C, "z"],
  ];
  let n = 0;
  for (const [x0, x1, z0, z1, dir] of rects) {
    if (dir === "x") {
      for (let z = z0; z < z1 - 0.01; z += 0.5 * s) {
        const zz = z + 0.25 * s;
        for (const [a, b] of segments(x0, x1, holes, "x", zz)) boxes.add("wood", (a + b) / 2, y - T / 2, zz, b - a - 0.03, T, 0.5 * s - 0.04, WOOD[n++ % 4]!);
      }
    } else {
      for (let x = x0; x < x1 - 0.01; x += 0.5 * s) {
        const xx = x + 0.25 * s;
        for (const [a, b] of segments(z0, z1, holes, "z", xx)) boxes.add("wood", xx, y - T / 2, (a + b) / 2, 0.5 * s - 0.04, T, b - a - 0.03, WOOD[n++ % 4]!);
      }
    }
  }
  for (const beam of layout?.beams ?? []) {
    if (beam.kind === "rect") boxes.add("wood", (beam.x0 + beam.x1) / 2, y - 0.13, (beam.z0 + beam.z1) / 2, beam.x1 - beam.x0, 0.26, beam.z1 - beam.z0, 0xc89a68);
    else boxes.add("wood", beam.cx, y - 0.13, beam.cz, beam.w, 0.26, beam.len, 0xc89a68, beam.ry);
  }
  // 斷口參差的斷板
  for (const h of holes) {
    const alongZ = h.x1 - h.x0 < h.z1 - h.z0;
    for (let i = 0; i < 3; i++) {
      const l = 0.3 + ((i * 37) % 5) / 10;
      if (alongZ) {
        const x = Math.max(h.x0, -R) + 0.3 + i * 0.5;
        if (h.z1 < R) boxes.add("dark", x, y - 0.14, h.z1 + 0.02 + l / 2, 0.42, 0.22, l, 0x7a5236, i % 2 ? 0.18 : -0.15);
        boxes.add("dark", x + 0.2, y - 0.14, h.z0 - 0.02 - l / 2, 0.42, 0.22, l, 0x7a5236, i % 2 ? -0.12 : 0.16);
      } else {
        const z = Math.max(h.z0, -R) + 0.3 + i * 0.5;
        if (h.x0 > -R) boxes.add("dark", h.x0 - 0.02 - l / 2 + l * 0.3, y - 0.14, z, l, 0.22, 0.42, 0x7a5236, i % 2 ? 0.18 : -0.15);
      }
    }
  }
  // 外緣的收邊木
  for (const [sx, sz, lx, lz] of [
    [0, 1, 2, 0],
    [1, 0, 0, 2],
    [0, -1, 2, 0],
    [-1, 0, 0, 2],
  ] as const) {
    boxes.add("dark", sx * (R + 0.06), y - 0.18, sz * (R + 0.06), lx ? R * 2 + 0.24 : 0.12, 0.32, lz ? R * 2 + 0.24 : 0.12, 0x6b4630);
  }
  railing(boxes, y, s, layout?.gaps ?? []);
  const p = layout?.platform;
  if (p && p.axis === "z") {
    const H = TOWER.platformHeight;
    const [c0, c1] = p.cross;
    const cx = (c0 + c1) / 2;
    const w = c1 - c0;
    const [t0, t1] = p.top;
    boxes.add("wood", cx, y + H / 2, (t0 + t1) / 2, w, H, t1 - t0, 0xd2a473);
    const ends = [
      { approach: p.low, edge: t0, dir: -1 },
      { approach: p.high, edge: t1, dir: 1 },
    ];
    for (const { approach, edge, dir } of ends) {
      if (approach.kind === "steps") {
        const depth = approach.len / 3;
        for (let i = 0; i < 3; i++) {
          const h = (H * (3 - i)) / 3;
          const z = edge + dir * (depth * i + depth / 2);
          boxes.add("wood", cx, y + h / 2, z, w, h, depth, [0xc8986a, 0xb07f52, 0x9c6e45][i]!);
          boxes.add("dark", cx, y + h + 0.005, z + dir * (depth / 2 - 0.03), w, 0.02, 0.05, 0x5a3322);
        }
      } else {
        const len = approach.len;
        const angle = Math.atan2(H, len);
        const slope = Math.hypot(H, len);
        boxes.add("wood", cx, y + H / 2 - 0.04, edge + (dir * len) / 2, w, 0.08, slope, 0xe0b583, 0, dir * angle);
      }
    }
  }
}

const roofMat = () => new THREE.MeshStandardMaterial({ color: 0x3f504e, roughness: 0.7, flatShading: true });
const roofEdgeMat = () => new THREE.MeshStandardMaterial({ color: 0x33413f, roughness: 0.7, flatShading: true });

/** 屋簷：四角錐台＋簷邊＋四角翹起 */
function roof(group: THREE.Group, yTop: number, rTop: number, rBot: number, h: number, bells: THREE.Object3D[] | null) {
  const main = roofMat();
  const edge = roofEdgeMat();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(rTop * Math.SQRT2, rBot * Math.SQRT2, h, 4, 1, true).rotateY(Math.PI / 4), main);
  body.position.y = yTop - h / 2;
  body.receiveShadow = true;
  group.add(body);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(rTop * Math.SQRT2, rTop * Math.SQRT2, 0.06, 4).rotateY(Math.PI / 4), edge);
  cap.position.y = yTop;
  group.add(cap);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(rBot * Math.SQRT2 + 0.1, rBot * Math.SQRT2 + 0.1, 0.16, 4, 1, true).rotateY(Math.PI / 4), edge);
  rim.position.y = yTop - h - 0.04;
  group.add(rim);
  const cone = new THREE.ConeGeometry(0.18, 0.9, 4);
  for (const [sx, sz] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const) {
    const tip = new THREE.Mesh(cone, edge);
    tip.position.set(sx * (rBot + 0.15), yTop - h + 0.2, sz * (rBot + 0.15));
    tip.rotation.z = -sx * 0.6;
    tip.rotation.x = sz * 0.6;
    group.add(tip);
    if (bells) {
      const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.17, 0.3, 10), new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.35, metalness: 0.6 }));
      bell.position.set(sx * (rBot - 0.1), yTop - h - 0.35, sz * (rBot - 0.1));
      bell.userData.swing = sx * 1.3 + sz * 0.7;
      group.add(bell);
      bells.push(bell);
    }
  }
}

export type TowerModel = {
  group: THREE.Group;
  /** 塔頂（第 5 層送達後才顯示）：屋頂、塔剎、簷角的鐘 */
  summit: THREE.Group;
  bells: THREE.Object3D[];
  spire: THREE.MeshStandardMaterial;
};

/**
 * 以目前這一層為中心建整座塔：目前這層在 y = 0、縮放 1；下面的樓層依外觀縮放、往下排；上面的樓層不畫（不然會擋住畫線鏡頭）。
 * layout 是目前這一層的版型（已套用翻轉）。shadows：是否投影（效能不足時關掉）。
 */
export function buildTower(layout: Layout, floor: number, shadows: boolean): TowerModel {
  const group = new THREE.Group();
  const boxes = new Boxes();
  const H = TOWER.levelHeight;
  const scaleOf = (k: number) => TOWER.scale[k - 1]! / TOWER.scale[floor - 1]!;
  for (let k = 1; k <= floor; k++) {
    const y = (k - floor) * H;
    level(boxes, y, scaleOf(k), k === floor ? layout : null);
    if (k > 1) roof(group, y - 0.32, 5.1 * scaleOf(k), 6.6 * scaleOf(k - 1), 1.15 + 0.05 * (5 - k), null);
  }
  // 樓梯：從樓梯口往後廊爬上一層
  const sign = layout.goal.x < 0 ? -1 : 1;
  const sx = layout.goal.x;
  for (let i = 0; i < 9; i++) {
    boxes.add("wood", sx, 0.15 + i * 0.29, -2.6 - i * 0.29, 1.6, 0.12, 0.34, WOOD[i % 4]!);
    boxes.add("dark", sx, i * 0.29, -2.62 - i * 0.29, 1.6, 0.3, 0.06, 0x6b4630);
  }
  boxes.add("lacquer", sx - 0.85 * sign, 1.4, -3.9, 0.1, 2.6, 0.1, LACQUER);
  boxes.add("lacquer", sx + 0.85 * sign, 1.4, -3.9, 0.1, 2.6, 0.1, LACQUER);
  // 塔基與地面
  const baseY = (1 - floor) * H - 2.8;
  const baseSize = 13 * scaleOf(1);
  boxes.add("stone", 0, baseY, 0, baseSize, 2, baseSize, 0x9aa39b);
  boxes.build(group, shadows);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(120, 32), new THREE.MeshStandardMaterial({ color: 0x8fa58a, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = baseY - 1;
  ground.receiveShadow = shadows;
  group.add(ground);
  // 樹林：一個 InstancedMesh
  const trees = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 2.6, 6), new THREE.MeshStandardMaterial({ color: 0x4f7357, roughness: 1, flatShading: true }), 120);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const color = new THREE.Color();
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 120; i++) {
    const a = rnd() * Math.PI * 2;
    const d = 13 + rnd() * 34;
    const size = 1 + rnd() * 1.8;
    v.set(Math.cos(a) * d, baseY - 1 + 1.3 * size, Math.sin(a) * d);
    trees.setMatrixAt(i, m.compose(v, q, sc.set(size, size, size)));
    trees.setColorAt(i, color.setHSL(0.36 + rnd() * 0.05, 0.22, 0.32 + rnd() * 0.1));
  }
  group.add(trees);
  // 遠山
  const mountain = new THREE.MeshStandardMaterial({ color: 0x7d978c, roughness: 1, flatShading: true });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.4;
    const d = 75 + (i % 3) * 12;
    const peak = new THREE.Mesh(new THREE.ConeGeometry(16 + (i % 3) * 5, 22 + (i % 2) * 10, 5), mountain);
    peak.position.set(Math.cos(a) * d, baseY + 8, Math.sin(a) * d);
    group.add(peak);
  }

  // 塔頂：第 5 層的屋頂、塔剎、簷角的鐘（送達時才顯示）
  const summit = new THREE.Group();
  const bells: THREE.Object3D[] = [];
  const spire = new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.35, metalness: 0.6, emissive: 0xffc860, emissiveIntensity: 0 });
  if (floor === 5) {
    roof(summit, H, 1.0, 6.6, 1.9, bells);
    for (let i = 0; i < 7; i++) {
      const r = i === 0 ? 0.55 : 0.32 - i * 0.025;
      const ring = new THREE.Mesh(i === 0 ? new THREE.CylinderGeometry(0.45, 0.6, 0.4, 12) : new THREE.TorusGeometry(r, 0.07, 8, 20), spire);
      if (i > 0) ring.rotation.x = Math.PI / 2;
      ring.position.y = H + 0.2 + i * 0.32;
      summit.add(ring);
    }
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.8, 8), spire);
    rod.position.y = H + 1.4;
    summit.add(rod);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), spire);
    orb.position.y = H + 2.9;
    summit.add(orb);
  }
  summit.visible = false;
  group.add(summit);
  return { group, summit, bells, spire };
}

// ---- 水窪、湯漬、金色圓圈 ----

const disc = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);

/** 雨水水窪：藍灰色、會反光（B12）。橢圓的轉法和 layouts.ts 的 inPuddle 相同（rotation.y = rot） */
export function puddleMesh(layout: Layout, p: Layout["puddles"][number]) {
  const group = new THREE.Group();
  const y = groundAt(layout, p).height + 0.012;
  const water = new THREE.MeshStandardMaterial({ color: 0x8fb8cc, roughness: 0.05, metalness: 0.25, transparent: true, opacity: 0.72 });
  const glint = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true, opacity: 0.55, depthWrite: false });
  const body = new THREE.Mesh(disc, water);
  body.scale.set(p.rx, 1, p.rz);
  body.rotation.y = p.rot;
  body.position.set(p.x, y, p.z);
  body.receiveShadow = true;
  group.add(body);
  const shine = new THREE.Mesh(disc, glint);
  shine.scale.set(p.rx * 0.45, 1, p.rz * 0.18);
  shine.rotation.y = p.rot + 0.5;
  shine.position.set(p.x - p.rx * 0.2, y + 0.003, p.z - p.rz * 0.25);
  group.add(shine);
  return group;
}

/** 灑出的湯漬：琥珀色、冒熱氣（B11）。回傳湯漬和三團熱氣（場景負責讓熱氣在 3 秒內淡掉） */
export function soupDecal(x: number, z: number, r: number, y: number) {
  const group = new THREE.Group();
  const soup = new THREE.MeshStandardMaterial({ color: 0xd89a35, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 });
  const body = new THREE.Mesh(disc, soup);
  body.scale.set(r, 1, r * 0.8);
  body.rotation.y = (x * 7 + z * 3) % Math.PI;
  body.position.set(x, y + 0.014, z);
  group.add(body);
  const steamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false });
  const steam: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.09 + i * 0.03, 8, 6), steamMat);
    puff.position.set(x + (i - 1) * r * 0.4, y + 0.25 + i * 0.28, z + (i % 2) * 0.1);
    group.add(puff);
    steam.push(puff);
  }
  return { group, steam, steamMat };
}

export function goalRing(layout: Layout) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.56, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xf0b443, fog: false, transparent: true, opacity: 0.95, depthWrite: false }),
  );
  ring.position.set(layout.goal.x, groundAt(layout, layout.goal).height + 0.02, layout.goal.z);
  return ring;
}

// ---- 和尚（H3） ----

export type MonkModel = {
  group: THREE.Group;
  body: THREE.Group;
  bowl: THREE.Group;
  soup: THREE.Mesh;
  steam: THREE.Mesh[];
  steamMat: THREE.MeshBasicMaterial;
  setWorried(worried: boolean): void;
};

/** 平滑光頭＋頭頂六個戒疤、大耳朵、黃僧袍＋朱紅袈裟、佛珠、瞇眼笑臉；摔落與湯灑光時換成驚訝表情 */
export function buildMonk(shadows: boolean): MonkModel {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const mat = (color: number, roughness = 0.7, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  const robe = mat(0xe2a23e);
  const kasaya = mat(0xa3322a, 0.75, { side: THREE.DoubleSide });
  const skin = mat(0xf3cca6, 0.6);
  const shoe = mat(0x2f2724, 0.8);
  const bead = mat(0x5b3420, 0.35);
  const dot = mat(0xb9805e, 0.6);
  const face = mat(0x3a2a22, 0.5);
  const cheek = mat(0xf29c8c, 0.8);
  const part = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = body) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadows;
    parent.add(mesh);
    return mesh;
  };
  for (const sx of [-1, 1]) part(new THREE.SphereGeometry(0.1, 12, 8), shoe, sx * 0.13, 0.04, 0.1).scale.set(0.9, 0.55, 1.4);
  part(new THREE.CylinderGeometry(0.25, 0.45, 0.82, 20), robe, 0, 0.43, 0);
  part(new THREE.CylinderGeometry(0.262, 0.462, 0.72, 20, 1, true, Math.PI * 0.95, Math.PI * 1.15), kasaya, 0, 0.47, 0);
  part(new THREE.BoxGeometry(0.2, 0.92, 0.05), kasaya, 0.02, 0.5, 0.33).rotation.set(-0.27, 0, 0.62);
  part(new THREE.BoxGeometry(0.2, 0.92, 0.05), kasaya, 0.02, 0.5, -0.33).rotation.set(0.27, 0, -0.62);
  part(new THREE.SphereGeometry(0.15, 14, 10), kasaya, -0.2, 0.8, 0).scale.set(1, 0.6, 1.1);
  // 佛珠：一圈合併成一個 InstancedMesh
  const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.04, 8, 6), bead, 18);
  const bm = new THREE.Matrix4();
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    beads.setMatrixAt(i, bm.makeTranslation(Math.sin(a) * 0.25, 0.9 - Math.max(0, Math.cos(a)) * 0.1, Math.cos(a) * 0.24 + 0.02));
  }
  body.add(beads);
  part(new THREE.SphereGeometry(0.06, 10, 8), bead, 0, 0.76, 0.28);
  const HY = 1.18;
  const HR = 0.37;
  part(new THREE.SphereGeometry(HR, 28, 20), skin, 0, HY, 0);
  // 六個戒疤
  const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 8, 6), dot, 6);
  let d = 0;
  for (const dx of [-0.1, 0, 0.1])
    for (const dz of [-0.07, 0.07]) dots.setMatrixAt(d++, bm.makeTranslation(dx, HY + Math.sqrt(HR * HR - dx * dx - dz * dz) - 0.005, dz));
  body.add(dots);
  for (const sx of [-1, 1]) part(new THREE.SphereGeometry(0.1, 14, 10), skin, sx * 0.36, HY - 0.03, 0).scale.set(0.55, 1.15, 0.7);
  const happy = new THREE.Group();
  const worried = new THREE.Group();
  body.add(happy, worried);
  for (const sx of [-1, 1]) {
    part(new THREE.TorusGeometry(0.05, 0.014, 6, 12, Math.PI), face, sx * 0.13, HY + 0.02, 0.34, happy).rotation.x = -0.2;
    part(new THREE.SphereGeometry(0.04, 8, 6), face, sx * 0.13, HY + 0.03, 0.335, worried);
    part(new THREE.CircleGeometry(0.055, 14), cheek, sx * 0.21, HY - 0.08, 0.3).rotation.y = sx * 0.55;
  }
  part(new THREE.TorusGeometry(0.045, 0.012, 6, 12, Math.PI), face, 0, HY - 0.1, 0.355, happy).rotation.set(-0.25, 0, Math.PI);
  part(new THREE.SphereGeometry(0.045, 8, 6), face, 0, HY - 0.11, 0.345, worried).scale.set(1, 1.3, 0.5);
  worried.visible = false;
  for (const sx of [-1, 1]) {
    const arm = part(new THREE.CylinderGeometry(0.1, 0.16, 0.46, 14), robe, sx * 0.27, 0.72, 0.2);
    arm.rotation.x = 1.2;
    arm.rotation.z = -sx * 0.25;
    part(new THREE.SphereGeometry(0.075, 12, 8), skin, sx * 0.17, 0.63, 0.43);
  }
  // 湯碗：白瓷、藍色碗緣、琥珀色湯面
  const bowl = new THREE.Group();
  bowl.position.set(0, 0.6, 0.48);
  body.add(bowl);
  const profile = [
    [0, 0],
    [0.12, 0],
    [0.13, 0.03],
    [0.24, 0.12],
    [0.29, 0.24],
    [0.27, 0.24],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  part(new THREE.LatheGeometry(profile, 24), mat(0xf4f1e8, 0.35, { side: THREE.DoubleSide }), 0, 0, 0, bowl);
  part(new THREE.TorusGeometry(0.28, 0.018, 6, 24), mat(0x3d6fa8, 0.4), 0, 0.24, 0, bowl).rotation.x = Math.PI / 2;
  const soup = part(new THREE.CircleGeometry(0.255, 20).rotateX(-Math.PI / 2), mat(0xd9962f, 0.2, { metalness: 0.05 }), 0, 0.2, 0, bowl);
  const steamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false });
  const steam = [0, 1, 2].map((i) => {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.07 + i * 0.03, 8, 6), steamMat);
    puff.position.set(Math.sin(i * 2) * 0.06, 0.35 + i * 0.22, 0);
    bowl.add(puff);
    return puff;
  });
  return {
    group,
    body,
    bowl,
    soup,
    steam,
    steamMat,
    setWorried(value) {
      happy.visible = !value;
      worried.visible = value;
    },
  };
}

/** 釋放一棵物件樹的 geometry 與 material（H7） */
export function disposeTree(root: THREE.Object3D) {
  const seen = new Set<unknown>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry && !seen.has(mesh.geometry) && mesh.geometry !== disc) {
      seen.add(mesh.geometry);
      mesh.geometry.dispose();
    }
    const material = mesh.material;
    for (const item of Array.isArray(material) ? material : material ? [material] : []) {
      if (seen.has(item)) continue;
      seen.add(item);
      item.dispose();
    }
  });
}
