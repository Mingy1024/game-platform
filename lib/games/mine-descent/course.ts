import { createRng, type Rng } from "../precise-stop/rng";
import { ANCHOR_KINDS, FIELD, KINDS, MIX, REACH_GAP, ROW, ZONES, type Kind } from "./config";

/**
 * 岩板的產生（D 組）：每一層依深度比例隨機抽種類，並保證至少有一塊「主路」岩板
 * （一般、礦軌推車、木支架、發光水晶其中一種），而且和上一層的主路岩板邊緣最多隔 REACH_GAP 公尺，
 * 玩家一定走得到。每一層的內容只由種子和層數決定。純邏輯。
 */
export type PlatformSpec = { kind: Kind; x: number; w: number; dir: 1 | -1 };
export type RowSpec = { index: number; platforms: PlatformSpec[]; anchor: number };

/** 深度對應的段（0–4） */
export function zoneIndex(depth: number): number {
  let index = 0;
  for (let i = 0; i < ZONES.length; i++) if (depth >= ZONES[i].from) index = i;
  return index;
}

/** 依權重抽一種岩板 */
export function pickKind(rng: Rng, depth: number, onlyAnchor = false): Kind {
  const mix = MIX[zoneIndex(depth)];
  const weights = KINDS.map((kind, i) => (onlyAnchor && !ANCHOR_KINDS.includes(kind) ? 0 : mix[i]));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng.next() * total;
  for (let i = 0; i < KINDS.length; i++) {
    roll -= weights[i];
    if (roll < 0) return KINDS[i];
  }
  return "rock";
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** 兩段區間 [a0,a1]、[b0,b1] 的間隔（重疊是 0） */
const gapBetween = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.max(a0, b0) - Math.min(a1, b1));

/**
 * 依序產生第 index 層。previous 是上一層的主路岩板（第一層沒有）。
 * 每層用「種子＋層數」獨立的亂數，同一層永遠一樣。
 */
export function makeRow(seed: number, index: number, depth: number, previous: PlatformSpec | null): RowSpec {
  const rng = createRng((seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0);
  const count = rng.int(ROW.minCount, ROW.maxCount);
  // 寬度以 0.1 公尺為單位（貼圖依寬度分檔）
  const width = () => Math.round((ROW.minWidth + rng.next() * (ROW.maxWidth - ROW.minWidth)) * 10) / 10;
  const margin = ROW.edgeMargin;

  // 主路岩板：和上一層的主路岩板邊緣隔不超過 REACH_GAP
  const w = width();
  const anchorKind = pickKind(rng, depth, true);
  let x: number;
  if (previous) {
    const lo = previous.x - previous.w / 2 - w / 2 - REACH_GAP;
    const hi = previous.x + previous.w / 2 + w / 2 + REACH_GAP;
    x = clamp(lo + rng.next() * (hi - lo), w / 2 + margin, FIELD.width - w / 2 - margin);
    // 夾到場地邊緣後仍要走得到：不行就貼著上一塊
    if (gapBetween(x - w / 2, x + w / 2, previous.x - previous.w / 2, previous.x + previous.w / 2) > REACH_GAP) {
      x = clamp(previous.x, w / 2 + margin, FIELD.width - w / 2 - margin);
    }
  } else {
    x = FIELD.width / 2;
  }
  const anchor: PlatformSpec = { kind: anchorKind, x, w, dir: rng.chance(0.5) ? 1 : -1 };
  const platforms: PlatformSpec[] = [anchor];

  // 其餘岩板：隨機位置，不和同一層的互相重疊（試幾次放不下就少放一塊）
  for (let n = 1; n < count; n++) {
    const pw = width();
    for (let attempt = 0; attempt < 6; attempt++) {
      const px = pw / 2 + margin + rng.next() * (FIELD.width - pw - margin * 2);
      const clear = platforms.every((p) => gapBetween(px - pw / 2, px + pw / 2, p.x - p.w / 2, p.x + p.w / 2) > 0.3);
      if (clear) {
        platforms.push({ kind: pickKind(rng, depth), x: px, w: pw, dir: rng.chance(0.5) ? 1 : -1 });
        break;
      }
    }
  }
  return { index, platforms, anchor: 0 };
}
