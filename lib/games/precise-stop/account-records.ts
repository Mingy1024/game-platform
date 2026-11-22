import { z } from "zod";
import { STATIONS_PER_RUN } from "./config";
import type { Mode } from "./route";
import { taiwanDateKey } from "./route";
import { comboMultiplier } from "./scoring";

/**
 * 精準停車的帳號紀錄：前端和伺服器共用的格式與檢查（帳號設計稿第 11 節）。
 * 純邏輯，不碰資料庫和瀏覽器。
 */

/** 理論最高分：每站完美 1,000 分，連擊倍率 1.0、1.1、1.2、1.3、1.4，合計 6,000（P5） */
export const MAX_RUN_SCORE = Array.from({ length: STATIONS_PER_RUN }, (_, index) =>
  Math.round(1000 * comboMultiplier(index + 1)),
).reduce((sum, value) => sum + value, 0);

/** 今日挑戰的日期只收台灣日期的這麼多天前到今天；帳號回傳的每日紀錄也是這個範圍 */
export const ACCOUNT_DAILY_DAYS = 14;
export const MAX_SYNC_BESTS = 15;
export const MAX_PERFECT_DELTA = 10_000;
/** 同步請求內容的上限（P6） */
export const MAX_SYNC_BODY_BYTES = 8 * 1024;

const DAY_MS = 86_400_000;
/** 手機時鐘可能比伺服器快：創下時間、今日挑戰的日期都容許晚 1 天，不因此整批拒絕 */
export const CLOCK_SKEW_MS = DAY_MS;

/** 一筆最佳紀錄。自由模式的 dateKey 是 null */
export type BestEntry = { mode: Mode; dateKey: string | null; score: number; achievedAt: number };

/**
 * playerId：前端以為的身分（Google 帳號或訪客）。和伺服器認得的不同就不寫（另一個分頁換了身分）。
 * null 表示還沒有身分、請建立訪客（精準停車設計稿第 14.3 節）。
 * consent：歐盟地區的人按了「上榜」（T11）；其他地區不用帶。
 */
export type SyncBody = { syncId: string; playerId: string | null; bests: BestEntry[]; perfectDelta: number; consent?: true };

/** GET／sync 回傳的帳號紀錄，格式和本機紀錄相同 */
export type AccountRecords = { daily: Record<string, number>; free: number | null; perfectStops: number };

/** 每日紀錄的日期範圍（含頭尾），都是台灣日期 */
export function dailyWindow(now: number): { from: string; to: string } {
  return { from: taiwanDateKey(now - ACCOUNT_DAILY_DAYS * DAY_MS), to: taiwanDateKey(now) };
}

/** 真的存在的日期（擋掉 2026-02-31 這種） */
function isCalendarDate(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const date = new Date(`${key}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === key;
}

const score = z.number().int().min(0).max(MAX_RUN_SCORE);
const achievedAt = z.number().int().min(0);
const best = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("daily"), dateKey: z.string(), score, achievedAt }),
  z.strictObject({ mode: z.literal("free"), dateKey: z.null(), score, achievedAt }),
]);
const syncSchema = z.strictObject({
  syncId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  playerId: z.string().min(1).max(64).nullable(),
  bests: z.array(best).max(MAX_SYNC_BESTS),
  perfectDelta: z.number().int().min(0).max(MAX_PERFECT_DELTA),
  consent: z.literal(true).optional(),
});

/**
 * 這一筆會存進帳號嗎（前端送出前也用它濾掉）。不會存的是：
 * - 日期不存在的今日挑戰
 * - 超過 14 天的今日挑戰（太舊）
 * - 日期或創下時間比現在晚超過時鐘誤差（手機時鐘快太多）
 */
export function isAcceptable(entry: BestEntry, now: number): boolean {
  if (entry.achievedAt > now + CLOCK_SKEW_MS) return false;
  if (entry.mode === "free") return true;
  if (!entry.dateKey || !isCalendarDate(entry.dateKey)) return false;
  return entry.dateKey >= dailyWindow(now).from && entry.dateKey <= taiwanDateKey(now + CLOCK_SKEW_MS);
}

/**
 * 檢查同步請求（第 18 題：只檢查分數範圍，不重算分數）。
 * 格式或分數範圍不對就整批不收，回傳 null（正常的前端不會送出這種資料）。
 * 日期太舊、時間在未來這類「時間不對」的只略過那一筆：快到期的紀錄可能剛好跨過午夜、手機時鐘可能不準，
 * 不能因為它讓同一批的其他紀錄和完美次數一起作廢（docs/dev/sync-checklist.md 第 5 節）。
 */
export function parseSyncBody(raw: unknown, now: number): SyncBody | null {
  const parsed = syncSchema.safeParse(raw);
  if (!parsed.success) return null;
  return { ...parsed.data, bests: parsed.data.bests.filter((entry) => isAcceptable(entry, now)) };
}

const bestKey = (entry: Pick<BestEntry, "mode" | "dateKey">) => `${entry.mode}:${entry.dateKey ?? ""}`;

/** 同一個模式、同一天只留最高分；同分時留比較早創下的 */
export function dedupeBests(entries: BestEntry[]): BestEntry[] {
  const map = new Map<string, BestEntry>();
  for (const entry of entries) {
    const key = bestKey(entry);
    const current = map.get(key);
    if (!current || entry.score > current.score || (entry.score === current.score && entry.achievedAt < current.achievedAt)) {
      map.set(key, entry);
    }
  }
  return [...map.values()];
}

/** 把還沒存到帳號的最佳紀錄和完美次數疊到帳號紀錄上（各取高分） */
export function overlay(base: AccountRecords, bests: BestEntry[], perfectDelta: number): AccountRecords {
  const daily = { ...base.daily };
  let free = base.free;
  for (const entry of bests) {
    if (entry.mode === "free") free = free === null ? entry.score : Math.max(free, entry.score);
    else if (entry.dateKey) daily[entry.dateKey] = Math.max(daily[entry.dateKey] ?? 0, entry.score);
  }
  return { daily, free, perfectStops: base.perfectStops + perfectDelta };
}

/** 伺服器回應的格式檢查（前端用）；不對就當作失敗 */
export function parseAccountRecords(raw: unknown): AccountRecords | null {
  const parsed = z
    .object({
      daily: z.record(z.string(), z.number().int().min(0)),
      free: z.number().int().min(0).nullable(),
      perfectStops: z.number().int().min(0),
    })
    .safeParse(raw);
  return parsed.success ? parsed.data : null;
}
