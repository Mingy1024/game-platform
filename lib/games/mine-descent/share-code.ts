import { MAX_DEPTH, MAX_SCORE, SCORE } from "./config";

/**
 * 成績代碼：把一局的結果編進網址，分享連結不需要資料庫。
 * 內容是深度、是否破紀錄（最高分／最深）和三項得分。總分不存在代碼裡，解碼後加總算出，所以代碼和分數不會對不上。
 */
const VERSION = 1;
/** 每走 1 公尺最多幾次驚險（邊緣落腳一層最多一次，擦過崩塌線每秒一次，取寬鬆的上限） */
const MAX_GRAZE_PER_METER = 2;
const BYTES = 1 + 1 + 4 + 4 * 3 + 1;

export type RunParts = { depth: number; graze: number; crystal: number };

export type SharedRun = {
  /** 下降的公尺數 */
  depth: number;
  newScore: boolean;
  newDepth: boolean;
  parts: RunParts;
};

export type DecodedRun = SharedRun & { total: number };

export const totalOf = (parts: RunParts) => parts.depth + parts.graze + parts.crystal;

function checksum(bytes: Uint8Array, length: number): number {
  let sum = 0x5a;
  for (let i = 0; i < length; i++) sum = (sum * 31 + bytes[i]) & 0xff;
  return sum;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) return null;
  try {
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

const clamp = (value: number, max: number) => Math.max(0, Math.min(max, Math.round(value)));

export function encodeRun(run: SharedRun): string {
  const bytes = new Uint8Array(BYTES);
  const view = new DataView(bytes.buffer);
  view.setUint8(0, VERSION);
  view.setUint8(1, (run.newScore ? 1 : 0) | (run.newDepth ? 2 : 0));
  view.setUint32(2, clamp(run.depth, MAX_DEPTH));
  view.setUint32(6, clamp(run.parts.depth, MAX_SCORE));
  view.setUint32(10, clamp(run.parts.graze, MAX_SCORE));
  view.setUint32(14, clamp(run.parts.crystal, MAX_SCORE));
  bytes[BYTES - 1] = checksum(bytes, BYTES - 1);
  return toBase64Url(bytes);
}

/** 代碼格式不對、被改過、版本不符或數字對不上都回傳 null，不會丟出錯誤 */
export function decodeRun(code: string): DecodedRun | null {
  if (typeof code !== "string" || code.length > 64) return null;
  const bytes = fromBase64Url(code);
  if (!bytes || bytes.length !== BYTES) return null;
  if (bytes[BYTES - 1] !== checksum(bytes, BYTES - 1)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint8(0) !== VERSION) return null;
  const flags = view.getUint8(1);
  if (flags > 0b11) return null;
  const depth = view.getUint32(2);
  const parts: RunParts = { depth: view.getUint32(6), graze: view.getUint32(10), crystal: view.getUint32(14) };
  const total = totalOf(parts);
  // 深度分一定落在每公尺 10 分（沒有倍率）到 20 分（最高 ×2.0）之間
  if (depth > MAX_DEPTH || total > MAX_SCORE) return null;
  if (parts.depth < depth * SCORE.perMeter || parts.depth > depth * SCORE.perMeter * SCORE.multMax) return null;
  // 驚險分、水晶分是一次一次加起來的：沒有就是 0，有就至少一次（驚險最少 50、水晶最少 30），而且次數不可能比走過的深度多太多
  if (parts.graze !== 0 && (parts.graze < SCORE.graze || parts.graze > MAX_GRAZE_PER_METER * SCORE.graze * SCORE.multMax * (depth + 5))) return null;
  if (parts.crystal !== 0 && (parts.crystal < SCORE.crystal || parts.crystal > SCORE.crystal * SCORE.multMax * (depth + 5))) return null;
  const run: SharedRun = { depth, newScore: (flags & 1) !== 0, newDepth: (flags & 2) !== 0, parts };
  // 只接受正規的編碼：同一份成績不能有好幾種寫法（Base64 結尾的多餘位元）
  if (encodeRun(run) !== code) return null;
  return { ...run, total };
}

/** 把一局的結果轉成可以分享的資料 */
export function toSharedRun(input: { depth: number; parts: RunParts; newScore: boolean; newDepth: boolean }): SharedRun {
  return { depth: input.depth, newScore: input.newScore, newDepth: input.newDepth, parts: input.parts };
}
