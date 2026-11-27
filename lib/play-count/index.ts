import { getGameBySlug } from "@/lib/catalog/catalog";

/**
 * 遊戲累計遊玩次數（所有玩家加總），計畫見 docs/plans/play-count.md。
 *
 * - 玩完一局（出現結算畫面）算一次，每款遊戲各自累計。
 * - 前端每局產生一個代碼（runId）送一次，失敗不重送；伺服器用 play_count_batches 擋同一個代碼重複加
 *   （記代碼與加一由觸發器在同一個 SQL 動作完成，migrations/0007）。
 * - 只存遊戲代號與總數，不存玩家、IP。
 */

/** 少於這個次數不顯示（剛上線數字太小，顯示出來反而沒說服力） */
export const PLAY_COUNT_MIN_DISPLAY = 100;

/** 擋重複的代碼保留幾天：前端不重送，2 天足夠涵蓋網路層的重試 */
export const PLAY_BATCH_TTL_DAYS = 2;

/** 請求內容上限（位元組）：{"runId":"…"} 遠小於這個值 */
export const MAX_PLAY_BODY_BYTES = 256;

const RUN_ID = /^[A-Za-z0-9_-]{16,64}$/;

/** 是不是站上有的遊戲（不接受亂填的 slug，避免計數表被塞進任意的列） */
export function isPlayCountGame(slug: unknown): slug is string {
  return typeof slug === "string" && getGameBySlug(slug) !== undefined;
}

/** 解析 POST 內容 { runId }；格式不對回 null */
export function parsePlayBody(body: unknown): { runId: string } | null {
  if (typeof body !== "object" || body === null) return null;
  const runId = (body as { runId?: unknown }).runId;
  return typeof runId === "string" && RUN_ID.test(runId) ? { runId } : null;
}

/** 介紹頁要不要顯示這個數字 */
export function shouldShowPlayCount(count: number | null | undefined): count is number {
  return typeof count === "number" && Number.isFinite(count) && count >= PLAY_COUNT_MIN_DISPLAY;
}

/** Prisma 在 D1 寫入 DateTime 的格式（固定 +00:00、毫秒三位），清理時用 julianday 比較 */
const toDbTime = (ms: number) => new Date(ms).toISOString().replace("Z", "+00:00");

/**
 * 記下一局：同一個代碼只會加一次。回傳這次有沒有加（重複的代碼是 false）。
 * INSERT OR IGNORE 撞到已有的代碼時不新增列，觸發器 play_count_batches_apply 也不會跑。
 */
export async function recordPlay(d1: D1Database, game: string, runId: string, now: number): Promise<boolean> {
  const result = await d1
    .prepare("INSERT OR IGNORE INTO play_count_batches (run_id, game, created_at) VALUES (?, ?, ?)")
    .bind(runId, game, toDbTime(now))
    .run();
  return result.meta.changes > 0;
}

/** 讀取一款遊戲的總數（還沒有人玩完過是 0） */
export async function readPlayCount(d1: D1Database, game: string): Promise<number> {
  const row = await d1.prepare("SELECT count FROM play_counts WHERE game = ?").bind(game).first<{ count: number }>();
  return row?.count ?? 0;
}

/** 每日排程：清掉超過保留期的擋重複紀錄（總數不受影響） */
export const PURGE_PLAY_BATCHES_SQL = `DELETE FROM play_count_batches WHERE julianday(created_at) <= julianday('now', '-${PLAY_BATCH_TTL_DAYS} days')`;
