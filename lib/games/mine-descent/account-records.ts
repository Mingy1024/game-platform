import { z } from "zod";
import { CLOCK_SKEW_MS, MAX_SYNC_BODY_BYTES } from "../precise-stop/account-records";
import { MAX_DEPTH, MAX_SCORE } from "./config";
import type { Records } from "./types";

/**
 * 礦坑大逃亡的帳號紀錄：前端和伺服器共用的格式與檢查（P 組）。
 * 純邏輯，不碰資料庫和瀏覽器。只存取高分的最佳紀錄（最高分、最深深度），沒有累計次數，所以重送是冪等的。
 */
export { CLOCK_SKEW_MS, MAX_SYNC_BODY_BYTES };
export const MAX_SYNC_BESTS = 4;

export type BestMode = "score" | "depth";
/** 一筆最佳紀錄：mode 是哪一種，score 是那一種的數值（分數或公尺） */
export type BestEntry = { mode: BestMode; score: number; achievedAt: number };

/**
 * playerId：前端以為的身分（Google 帳號或訪客）。和伺服器認得的不同就不寫（另一個分頁換了身分）。
 * null 表示還沒有身分、請建立訪客。syncId 只用在建立訪客：同一個 syncId 找回同一個訪客（T9）。
 * consent：歐盟地區的人按了「上榜」（T11）。
 */
export type SyncBody = { syncId: string; playerId: string | null; bests: BestEntry[]; consent?: true };

/** GET／sync 回傳的帳號紀錄，格式和本機紀錄相同 */
export type AccountRecords = Records;

export const LIMITS: Record<BestMode, number> = { score: MAX_SCORE, depth: MAX_DEPTH };

const achievedAt = z.number().int().min(0);
const best = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("score"), score: z.number().int().min(0).max(MAX_SCORE), achievedAt }),
  z.strictObject({ mode: z.literal("depth"), score: z.number().int().min(0).max(MAX_DEPTH), achievedAt }),
]);
const syncSchema = z.strictObject({
  syncId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  playerId: z.string().min(1).max(64).nullable(),
  bests: z.array(best).max(MAX_SYNC_BESTS),
  consent: z.literal(true).optional(),
});

/**
 * 這一筆會存進帳號嗎（前端送出前也用它濾掉）。創下時間比現在晚超過時鐘誤差（手機時鐘快太多）的略過，
 * 只略過那一筆，不讓整批被拒（sync-checklist 第 5 節）。
 */
export const isAcceptable = (entry: BestEntry, now: number): boolean => entry.achievedAt <= now + CLOCK_SKEW_MS;

/** 檢查同步請求（只檢查數值範圍，不重算分數，T18）。格式或範圍不對回傳 null */
export function parseSyncBody(raw: unknown, now: number): SyncBody | null {
  const parsed = syncSchema.safeParse(raw);
  if (!parsed.success) return null;
  return { ...parsed.data, bests: parsed.data.bests.filter((entry) => isAcceptable(entry, now)) };
}

/** 同一種只留最高的；同值時留比較早創下的 */
export function dedupeBests(entries: BestEntry[]): BestEntry[] {
  const map = new Map<BestMode, BestEntry>();
  for (const entry of entries) {
    const current = map.get(entry.mode);
    if (!current || entry.score > current.score || (entry.score === current.score && entry.achievedAt < current.achievedAt)) {
      map.set(entry.mode, entry);
    }
  }
  return [...map.values()];
}

/** 把還沒存到帳號的最佳紀錄疊到帳號紀錄上（各取高值） */
export function overlay(base: AccountRecords, bests: BestEntry[]): AccountRecords {
  const next = { ...base };
  for (const entry of bests) {
    const current = next[entry.mode];
    next[entry.mode] = current === null ? entry.score : Math.max(current, entry.score);
  }
  return next;
}

/** 伺服器回應的格式檢查（前端用）；不對就當作失敗 */
export function parseAccountRecords(raw: unknown): AccountRecords | null {
  const parsed = z
    .object({ score: z.number().int().min(0).nullable(), depth: z.number().int().min(0).nullable() })
    .safeParse(raw);
  return parsed.success ? parsed.data : null;
}
