import { TICKS_PER_SECOND } from "./config";
import { totalScore, type Ending, type ScoreParts } from "./scoring";

/**
 * 成績代碼：把一局的結果編進網址，分享連結不需要資料庫。
 * 內容是日期、結局、是否破紀錄、是否隱藏結局、衝出大門的時間（0.1 秒）和四項得分。
 * 總分不存在代碼裡，解碼後用同一套計分規則重算，所以代碼和分數不會對不上。
 */
const VERSION = 1;
const EPOCH = Date.UTC(2026, 0, 1);
const DAY = 86400000;
const BYTES = 1 + 1 + 2 + 2 + 8 + 1;
const ENDINGS: Ending[] = ["fast", "ontime", "overtime"];
const MAX_PART = 0xffff;
const MAX_TENTHS = 0xffff;

export type SharedRun = {
  /** YYYY-MM-DD（台灣日期） */
  dateKey: string;
  ending: Ending;
  hidden: boolean;
  newRecord: boolean;
  /** 衝出大門（或被攔下）時的時鐘，0.1 秒為單位，從 18:00:00 起算 */
  clockTenths: number;
  parts: ScoreParts;
};

export type DecodedRun = SharedRun & { total: number };

function checksum(bytes: Uint8Array, length: number): number {
  let sum = 0x3c;
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

const clampPart = (value: number) => Math.max(0, Math.min(MAX_PART, Math.round(value)));

/** 結局和時鐘要對得上：秒速下班 ≤ 60.0 秒、準時下班 60.1–90.0 秒、加班 > 90 秒 */
function consistent(ending: Ending, clockTenths: number): boolean {
  if (ending === "fast") return clockTenths <= 600;
  if (ending === "ontime") return clockTenths > 600 && clockTenths <= 900;
  return clockTenths >= 900;
}

export function encodeRun(run: SharedRun): string {
  const bytes = new Uint8Array(BYTES);
  const view = new DataView(bytes.buffer);
  const day = Math.round((Date.parse(`${run.dateKey}T00:00:00Z`) - EPOCH) / DAY);
  view.setUint8(0, VERSION);
  view.setUint8(1, (run.newRecord ? 1 : 0) | (run.hidden ? 2 : 0) | (ENDINGS.indexOf(run.ending) << 2));
  view.setUint16(2, Math.max(0, Math.min(0xffff, day)));
  view.setUint16(4, Math.max(0, Math.min(MAX_TENTHS, Math.round(run.clockTenths))));
  view.setUint16(6, clampPart(run.parts.time));
  view.setUint16(8, clampPart(run.parts.graze));
  view.setUint16(10, clampPart(run.parts.event));
  view.setUint16(12, clampPart(run.parts.item));
  bytes[BYTES - 1] = checksum(bytes, BYTES - 1);
  return toBase64Url(bytes);
}

/** 代碼格式不對、被改過或版本不符都回傳 null，不會丟出錯誤 */
export function decodeRun(code: string): DecodedRun | null {
  if (typeof code !== "string" || code.length > 64) return null;
  const bytes = fromBase64Url(code);
  if (!bytes || bytes.length !== BYTES) return null;
  if (bytes[BYTES - 1] !== checksum(bytes, BYTES - 1)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint8(0) !== VERSION) return null;
  const flags = view.getUint8(1);
  const ending = ENDINGS[(flags >> 2) & 3];
  if (!ending || flags > 0b1011) return null;
  const hidden = (flags & 2) !== 0;
  const clockTenths = view.getUint16(4);
  if (!consistent(ending, clockTenths) || (hidden && ending === "overtime")) return null;
  const parts: ScoreParts = {
    time: view.getUint16(6),
    graze: view.getUint16(8),
    event: view.getUint16(10),
    item: view.getUint16(12),
  };
  const dateKey = new Date(EPOCH + view.getUint16(2) * DAY).toISOString().slice(0, 10);
  return { dateKey, ending, hidden, newRecord: (flags & 1) !== 0, clockTenths, parts, total: totalScore(parts, ending) };
}

/** 把一局的結果轉成可以分享的資料 */
export function toSharedRun(input: {
  dateKey: string;
  newRecord: boolean;
  ending: Ending;
  hidden: boolean;
  clockTicks: number;
  parts: ScoreParts;
}): SharedRun {
  return {
    dateKey: input.dateKey,
    ending: input.ending,
    hidden: input.hidden,
    newRecord: input.newRecord,
    clockTenths: Math.round((input.clockTicks / TICKS_PER_SECOND) * 10),
    parts: input.parts,
  };
}

/** 衝出大門的時間字串，例如 18:00:47（以 0.1 秒進位前的整秒顯示） */
export function clockFromTenths(clockTenths: number): string {
  const total = 18 * 3600 + Math.floor(clockTenths / 10);
  const h = Math.floor(total / 3600) % 24;
  const m = Math.floor(total / 60) % 60;
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
