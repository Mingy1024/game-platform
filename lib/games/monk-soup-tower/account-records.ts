import { z } from "zod";
import { CLOCK_SKEW_MS, MAX_SYNC_BODY_BYTES } from "../precise-stop/account-records";
import { LIMITS, SCORE } from "./config";
import { compareRuns } from "./scoring";
import type { Mode } from "./tower";
import type { AccountRecords, Best } from "./types";

/**
 * 和尚端湯上塔的帳號紀錄：前端和伺服器共用的格式與檢查（P 組）。
 * 純邏輯，不碰資料庫和瀏覽器。只存取最佳的紀錄（分數高、同分時間短），沒有累計次數，所以重送是冪等的。
 */
export { CLOCK_SKEW_MS, MAX_SYNC_BODY_BYTES };
export type { AccountRecords };
export const MAX_SYNC_BESTS = 4;

/** 一筆最佳紀錄 */
export type BestEntry = { mode: Mode; score: number; timeMs: number; achievedAt: number };

/**
 * playerId：前端以為的身分（Google 帳號或訪客）。和伺服器認得的不同就不寫（另一個分頁換了身分）。
 * null 表示還沒有身分、請建立訪客。syncId 只用在建立訪客：同一個 syncId 找回同一個訪客（T8）。
 * consent：歐盟地區的人按了「上榜」（T10）。
 */
export type SyncBody = { syncId: string; playerId: string | null; bests: BestEntry[]; consent?: true };

const best = z.strictObject({
  mode: z.enum(["fixed", "random"]),
  score: z.number().int().min(0).max(SCORE.max),
  timeMs: z.number().int().min(LIMITS.minTimeMs).max(LIMITS.maxTimeMs),
  achievedAt: z.number().int().min(0),
});
const syncSchema = z.strictObject({
  syncId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  playerId: z.string().min(1).max(64).nullable(),
  bests: z.array(best).max(MAX_SYNC_BESTS),
  consent: z.literal(true).optional(),
});

/** 創下時間比現在晚超過時鐘誤差（手機時鐘快太多）的略過那一筆，不讓整批被拒（P5） */
export const isAcceptable = (entry: BestEntry, now: number): boolean => entry.achievedAt <= now + CLOCK_SKEW_MS;

/** 檢查同步請求（只檢查範圍，不重算分數，T12）。格式或範圍不對回傳 null */
export function parseSyncBody(raw: unknown, now: number): SyncBody | null {
  const parsed = syncSchema.safeParse(raw);
  if (!parsed.success) return null;
  return { ...parsed.data, bests: parsed.data.bests.filter((entry) => isAcceptable(entry, now)) };
}

/** a 比 b 好嗎：分數高、同分時間短、再同先創下的（P4） */
export const entryBetter = (a: BestEntry, b: BestEntry): boolean => compareRuns(a, b) < 0 || (compareRuns(a, b) === 0 && a.achievedAt < b.achievedAt);

/** 同一種模式只留最好的一筆 */
export function dedupeBests(entries: BestEntry[]): BestEntry[] {
  const map = new Map<Mode, BestEntry>();
  for (const entry of entries) {
    const current = map.get(entry.mode);
    if (!current || entryBetter(entry, current)) map.set(entry.mode, entry);
  }
  return [...map.values()];
}

/** 把還沒存到帳號的最佳紀錄疊到帳號紀錄上（各取最佳） */
export function overlay(base: AccountRecords, bests: BestEntry[]): AccountRecords {
  const next = { ...base };
  for (const entry of bests) {
    const current = next[entry.mode];
    const candidate: Best = { score: entry.score, timeMs: entry.timeMs };
    if (current === null || compareRuns(candidate, current) < 0) next[entry.mode] = candidate;
  }
  return next;
}

const bestSchema = z.object({ score: z.number().int().min(0), timeMs: z.number().int().min(0) }).nullable();

/** 伺服器回應的格式檢查（前端用）；不對就當作失敗 */
export function parseAccountRecords(raw: unknown): AccountRecords | null {
  const parsed = z.object({ fixed: bestSchema, random: bestSchema }).safeParse(raw);
  return parsed.success ? { fixed: parsed.data.fixed, random: parsed.data.random } : null;
}
