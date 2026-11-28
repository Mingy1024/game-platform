import { LIMITS, SEED } from "./config";
import { displayTemp, gradeOf, scoreOf, tempBand, temperatureAt, type Grade, type TempBand } from "./scoring";
import type { Mode } from "./tower";

/**
 * 成績代碼（J3）：把送達塔頂的一局編進網址，分享連結不需要資料庫。
 * 內容是模式、塔號（隨機模式）、湯量（千分比）、總時間、得分與是否破紀錄。
 * 得分一定要等於「湯量與時間算出來的分數」，被改過、格式不對、版本不符都回傳 null。
 */
const VERSION = 1;
const BYTES = 1 + 1 + 4 + 2 + 4 + 2 + 1;

export type SharedRun = {
  mode: Mode;
  /** 隨機模式的塔號；固定關卡是 null */
  seed: number | null;
  /** 剩下的湯（千分比） */
  soup: number;
  timeMs: number;
  score: number;
  newRecord: boolean;
};

export type DecodedRun = SharedRun & { temp: number; band: TempBand; grade: Grade };

function checksum(bytes: Uint8Array, length: number): number {
  let sum = 0x6b;
  for (let i = 0; i < length; i++) sum = (sum * 31 + bytes[i]!) & 0xff;
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

export function encodeRun(run: SharedRun): string {
  const bytes = new Uint8Array(BYTES);
  const view = new DataView(bytes.buffer);
  view.setUint8(0, VERSION);
  view.setUint8(1, (run.mode === "random" ? 1 : 0) | (run.newRecord ? 2 : 0));
  view.setUint32(2, run.mode === "random" ? (run.seed ?? 0) : 0);
  view.setUint16(6, Math.max(0, Math.min(1000, Math.round(run.soup))));
  view.setUint32(8, Math.max(0, Math.round(run.timeMs)));
  view.setUint16(12, Math.max(0, Math.min(1000, Math.round(run.score))));
  bytes[BYTES - 1] = checksum(bytes, BYTES - 1);
  return toBase64Url(bytes);
}

export function decodeRun(code: string): DecodedRun | null {
  if (typeof code !== "string" || code.length > 64) return null;
  const bytes = fromBase64Url(code);
  if (!bytes || bytes.length !== BYTES) return null;
  if (bytes[BYTES - 1] !== checksum(bytes, BYTES - 1)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint8(0) !== VERSION) return null;
  const flags = view.getUint8(1);
  if (flags > 0b11) return null;
  const mode: Mode = flags & 1 ? "random" : "fixed";
  const rawSeed = view.getUint32(2);
  const soup = view.getUint16(6);
  const timeMs = view.getUint32(8);
  const score = view.getUint16(12);
  if (mode === "random" && (rawSeed < SEED.min || rawSeed > SEED.max)) return null;
  if (mode === "fixed" && rawSeed !== 0) return null;
  if (soup > 1000 || timeMs < LIMITS.minTimeMs || timeMs > LIMITS.maxTimeMs) return null;
  if (score !== scoreOf(soup, timeMs)) return null;
  const run: SharedRun = { mode, seed: mode === "random" ? rawSeed : null, soup, timeMs, score, newRecord: (flags & 2) !== 0 };
  // 只接受正規的編碼：同一份成績不能有好幾種寫法
  if (encodeRun(run) !== code) return null;
  return { ...run, temp: displayTemp(timeMs), band: tempBand(temperatureAt(timeMs)), grade: gradeOf(score) };
}
