import { FLOORS, SEED } from "./config";
import { flipLayout, layoutsOf, type Layout } from "./layouts";

/**
 * 一座塔：五層各用哪一種版型、要不要左右翻轉（D1–D3、D8）。
 * - 固定關卡（fixed）：每一層都是代表版型（第一種）、不翻轉，所有玩家、每一局都一樣。
 * - 隨機模式（random）：塔號（種子）決定每層的版型與翻轉；同一個塔號一定是同一座塔。
 */
export type Mode = "fixed" | "random";
export const MODES = ["fixed", "random"] as const satisfies readonly Mode[];
export const isMode = (value: unknown): value is Mode => value === "fixed" || value === "random";

export type Tower = { mode: Mode; seed: number | null; floors: Layout[] };

/** mulberry32：小而快、結果在每個平台都一樣的亂數 */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const isSeed = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= SEED.min && value <= SEED.max;

/** 新的塔號（隨機模式每局一個）。random 給測試換掉 */
export const randomSeed = (random: () => number = Math.random): number => SEED.min + Math.floor(random() * (SEED.max - SEED.min + 1));

export function fixedTower(): Tower {
  return { mode: "fixed", seed: null, floors: Array.from({ length: FLOORS }, (_, i) => layoutsOf(i + 1)[0]!) };
}

export function randomTower(seed: number): Tower {
  const next = rng(seed * 2654435761);
  const floors = Array.from({ length: FLOORS }, (_, i) => {
    const options = layoutsOf(i + 1);
    const layout = options[Math.floor(next() * options.length)]!;
    return next() < 0.5 ? flipLayout(layout) : layout;
  });
  return { mode: "random", seed, floors };
}

export const towerFor = (mode: Mode, seed: number | null): Tower => (mode === "random" && seed !== null ? randomTower(seed) : fixedTower());

/** 塔號的顯示格式：#012345 */
export const seedLabel = (seed: number): string => `#${String(seed).padStart(6, "0")}`;
