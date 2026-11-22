import { z } from "zod";
import { ACCOUNT_DAILY_DAYS, CLOCK_SKEW_MS, MAX_SYNC_BODY_BYTES } from "../precise-stop/account-records";
import { SCORE, SEGMENTS } from "./config";
import { LAYOUT, taiwanDateKey } from "./route";
import type { Records } from "./types";

/**
 * 下班逃離辦公室的帳號紀錄：前端和伺服器共用的格式與檢查（P 組）。
 * 純邏輯，不碰資料庫和瀏覽器。只存取高分的最佳紀錄，沒有累計次數，所以重送是冪等的。
 */
export { ACCOUNT_DAILY_DAYS, CLOCK_SKEW_MS, MAX_SYNC_BODY_BYTES };
export const MAX_SYNC_BESTS = 15;

/**
 * 分數上限（P4）：每一段都拿滿時間分（目標秒數 × 100）、每個障礙都擦身（最高 ×1.5 的 75 分）、
 * 三次事件都選最佳、撿齊所有道具，再乘 ×2.0。實際上不可能這麼高，只用來擋明顯不合理的資料。
 */
export const MAX_RUN_SCORE = Math.round(
  (SEGMENTS.reduce((sum, segment) => sum + segment.target * 100, 0) +
    LAYOUT.obstacles.length * Math.round(SCORE.graze * SCORE.grazeMax) +
    3 * SCORE.eventBest +
    LAYOUT.itemSlots.length * SCORE.item) *
    2,
);

export type BestMode = "daily" | "all";
/** 一筆最佳紀錄。歷史最佳（all）的 dateKey 是 null */
export type BestEntry = { mode: BestMode; dateKey: string | null; score: number; achievedAt: number };

/**
 * playerId：前端以為的身分（Google 帳號或訪客）。和伺服器認得的不同就不寫（另一個分頁換了身分）。
 * null 表示還沒有身分、請建立訪客。syncId 只用在建立訪客：同一個 syncId 找回同一個訪客（T9）。
 * consent：歐盟地區的人按了「上榜」（T11）。
 */
export type SyncBody = { syncId: string; playerId: string | null; bests: BestEntry[]; consent?: true };

/** GET／sync 回傳的帳號紀錄，格式和本機紀錄相同 */
export type AccountRecords = Records;

const DAY_MS = 86_400_000;

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
  z.strictObject({ mode: z.literal("all"), dateKey: z.null(), score, achievedAt }),
]);
const syncSchema = z.strictObject({
  syncId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  playerId: z.string().min(1).max(64).nullable(),
  bests: z.array(best).max(MAX_SYNC_BESTS),
  consent: z.literal(true).optional(),
});

/**
 * 這一筆會存進帳號嗎（前端送出前也用它濾掉）。不會存的是：日期不存在的、超過 14 天的每日紀錄、
 * 日期或創下時間比現在晚超過時鐘誤差（手機時鐘快太多）。時間不對只略過那一筆，不讓整批被拒（sync-checklist 第 5 節）。
 */
export function isAcceptable(entry: BestEntry, now: number): boolean {
  if (entry.achievedAt > now + CLOCK_SKEW_MS) return false;
  if (entry.mode === "all") return true;
  if (!entry.dateKey || !isCalendarDate(entry.dateKey)) return false;
  return entry.dateKey >= dailyWindow(now).from && entry.dateKey <= taiwanDateKey(now + CLOCK_SKEW_MS);
}

/** 檢查同步請求（只檢查分數範圍，不重算分數，T18）。格式或分數不對回傳 null；時間不對的略過那一筆 */
export function parseSyncBody(raw: unknown, now: number): SyncBody | null {
  const parsed = syncSchema.safeParse(raw);
  if (!parsed.success) return null;
  return { ...parsed.data, bests: parsed.data.bests.filter((entry) => isAcceptable(entry, now)) };
}

const bestKey = (entry: Pick<BestEntry, "mode" | "dateKey">) => `${entry.mode}:${entry.dateKey ?? ""}`;

/** 同一種、同一天只留最高分；同分時留比較早創下的 */
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

/** 把還沒存到帳號的最佳紀錄疊到帳號紀錄上（各取高分） */
export function overlay(base: AccountRecords, bests: BestEntry[]): AccountRecords {
  const daily = { ...base.daily };
  let all = base.best;
  for (const entry of bests) {
    if (entry.mode === "all") all = all === null ? entry.score : Math.max(all, entry.score);
    else if (entry.dateKey) daily[entry.dateKey] = Math.max(daily[entry.dateKey] ?? 0, entry.score);
  }
  return { daily, best: all };
}

/** 伺服器回應的格式檢查（前端用）；不對就當作失敗 */
export function parseAccountRecords(raw: unknown): AccountRecords | null {
  const parsed = z
    .object({ daily: z.record(z.string(), z.number().int().min(0)), best: z.number().int().min(0).nullable() })
    .safeParse(raw);
  return parsed.success ? parsed.data : null;
}
