import { CAMERA, SAFE } from "./config";
import type { Layout, Vec2 } from "./layouts";
import type { PathSample } from "./path";

/**
 * 鏡頭（F4、F5、G1、G5）。three.js 的場景照這裡的數值擺鏡頭；
 * 另外提供不依賴 three.js 的投影計算，單元測試用它檢查版型在畫線鏡頭下有沒有落在畫面內（D7）。
 */
export type Vec3 = [number, number, number];
export type CameraPose = { pos: Vec3; target: Vec3; fov: number };

/** 畫線鏡頭：塔外右前方高處往下看；翻轉的版型從左前方看 */
export function drawCamera(flipped: boolean): CameraPose {
  const { pos, target, fov } = CAMERA.draw;
  const sign = flipped ? -1 : 1;
  return { pos: [pos[0] * sign, pos[1], pos[2]], target: [target[0] * sign, target[1], target[2]], fov };
}

/**
 * 走路鏡頭：和尚後方 2.8、內側（靠塔身那一側）0.9、高 3.9，看向前方路線（F5）。
 * here：和尚所在的路線點；ahead：往前 lookAhead 單位的路線點；y：腳下高度
 */
export function walkCamera(here: PathSample, ahead: Vec2, y = 0): CameraPose {
  const w = CAMERA.walk;
  let nx = -here.tz;
  let nz = here.tx;
  // 法向量朝塔身（原點）那一側才是「內側」
  if (nx * -here.x + nz * -here.z < 0) {
    nx = -nx;
    nz = -nz;
  }
  return {
    pos: [here.x - here.tx * w.back + nx * w.inside, y + w.height, here.z - here.tz * w.back + nz * w.inside],
    target: [ahead.x, y + w.lookY, ahead.z],
    fov: w.fov,
  };
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** 透視投影：世界座標 → 畫面 px（左上是 0,0）。在鏡頭後面回傳 null */
export function project(camera: CameraPose, point: Vec3, width: number = SAFE.width, height: number = SAFE.height): { x: number; y: number } | null {
  const forward = norm(sub(camera.target, camera.pos));
  const right = norm(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const d = sub(point, camera.pos);
  const depth = dot(d, forward);
  if (depth <= 0) return null;
  const half = Math.tan((camera.fov * Math.PI) / 360);
  const aspect = width / height;
  return {
    x: ((dot(d, right) / (depth * half * aspect)) * 0.5 + 0.5) * width,
    y: (0.5 - (dot(d, up) / (depth * half)) * 0.5) * height,
  };
}

/** 畫面上的點在不在安全區（不被上方 HUD、下方按鈕蓋住，D7） */
export const inSafeArea = (p: { x: number; y: number } | null): boolean =>
  p !== null && p.x >= 0 && p.x <= SAFE.width && p.y >= SAFE.top && p.y <= SAFE.height - SAFE.bottom;

/**
 * 路線區域：起點所在的前廊（從起點往左多留 1 單位）、轉角與右廊（到樓梯口後方 1 單位）。
 * 玩家只會在這一段畫線；背面與另一側的迴廊被塔身擋住、也不在畫面裡。
 */
export function routeRegion(layout: Layout): { x0: number; x1: number; z0: number; z1: number }[] {
  const sign = layout.flipped ? -1 : 1;
  const sx = layout.start.x * sign;
  const front = { x0: sx - 1, x1: 5, z0: 3, z1: 5 };
  const right = { x0: 3, x1: 5, z0: layout.goal.z - 1, z1: 3 };
  const mirror = (r: typeof front) => (sign === 1 ? r : { x0: -r.x1, x1: -r.x0, z0: r.z0, z1: r.z1 });
  return [mirror(front), mirror(right)];
}
