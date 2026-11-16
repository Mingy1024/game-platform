import { STATIONS_PER_RUN } from "./config";
import type { Mode } from "./route";
import { scoreRun, totalScore, type StopResult } from "./scoring";
import { STATION_IDS, type StationId } from "./stations";

/**
 * 成績代碼：把一局的結果編進網址，分享連結不需要資料庫。
 * 內容是模式、日期、是否破紀錄，以及每站的站名、誤差（公釐）和超時（0.1 秒）。
 * 分數不存在代碼裡，解碼後用同一套計分規則重算，所以代碼和分數不會對不上。
 */
const VERSION = 1;
const EPOCH = Date.UTC(2026, 0, 1);
const DAY = 86400000;
const BYTES = 4 + STATIONS_PER_RUN * 5 + 1;
/** 誤差上限（公釐），超過就記成這個值，一樣是失誤 */
const MAX_ERROR_MM = 32000;
const MAX_OVERTIME = 6000;

export type SharedStop = {
  station: StationId;
  /** 誤差（公釐）。正值過站。 */
  errorMm: number;
  /** 超時（0.1 秒為單位的整數） */
  overtimeTenths: number;
};

export type SharedRun = {
  mode: Mode;
  /** YYYY-MM-DD（台灣日期） */
  dateKey: string;
  newRecord: boolean;
  stops: SharedStop[];
};

export type DecodedRun = SharedRun & { results: StopResult[]; total: number };

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

export function encodeRun(run: SharedRun): string {
  if (run.stops.length !== STATIONS_PER_RUN) throw new Error("一局必須是 5 站");
  const bytes = new Uint8Array(BYTES);
  const view = new DataView(bytes.buffer);
  const day = Math.round((Date.parse(`${run.dateKey}T00:00:00Z`) - EPOCH) / DAY);
  view.setUint8(0, VERSION);
  view.setUint8(1, (run.mode === "daily" ? 1 : 0) | (run.newRecord ? 2 : 0));
  view.setUint16(2, Math.max(0, Math.min(0xffff, day)));
  run.stops.forEach((stop, index) => {
    const offset = 4 + index * 5;
    view.setUint8(offset, STATION_IDS.indexOf(stop.station));
    view.setInt16(
      offset + 1,
      Math.max(-MAX_ERROR_MM, Math.min(MAX_ERROR_MM, Math.round(stop.errorMm))),
    );
    view.setUint16(offset + 3, Math.max(0, Math.min(MAX_OVERTIME, Math.round(stop.overtimeTenths))));
  });
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
  if (flags > 3) return null;
  const dateKey = new Date(EPOCH + view.getUint16(2) * DAY).toISOString().slice(0, 10);
  const stops: SharedStop[] = [];
  for (let index = 0; index < STATIONS_PER_RUN; index++) {
    const offset = 4 + index * 5;
    const station = STATION_IDS[view.getUint8(offset)];
    if (!station) return null;
    const errorMm = view.getInt16(offset + 1);
    const overtimeTenths = view.getUint16(offset + 3);
    if (Math.abs(errorMm) > MAX_ERROR_MM || overtimeTenths > MAX_OVERTIME) return null;
    stops.push({ station, errorMm, overtimeTenths });
  }
  if (new Set(stops.map((stop) => stop.station)).size !== stops.length) return null;
  const results = scoreRun(
    stops.map((stop) => ({
      error: stop.errorMm / 1000,
      elapsed: stop.overtimeTenths / 10,
      target: 0,
    })),
  );
  return {
    mode: flags & 1 ? "daily" : "free",
    newRecord: (flags & 2) !== 0,
    dateKey,
    stops,
    results,
    total: totalScore(results),
  };
}

/** 把一局的實際結果轉成可以分享的資料 */
export function toSharedRun(input: {
  mode: Mode;
  dateKey: string;
  newRecord: boolean;
  stations: StationId[];
  results: StopResult[];
}): SharedRun {
  return {
    mode: input.mode,
    dateKey: input.dateKey,
    newRecord: input.newRecord,
    stops: input.results.map((result, index) => ({
      station: input.stations[index],
      // 自動緊急停車的誤差可能超過上限，夾住後仍然是失誤
      errorMm: Math.round(result.error * 1000),
      overtimeTenths: Math.round(result.overtime * 10),
    })),
  };
}
