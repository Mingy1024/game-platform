/** 訪客相關的純 SQL（D1 binding）。單元測試用 node:sqlite 跑同樣的 migrations 驗證（lib/account/__tests__/guest-merge.test.ts） */

/** 訪客幾天沒玩就刪掉（紀錄、session 一起 CASCADE，T16） */
export const GUEST_TTL_DAYS = 90;
/**
 * 每日排程刪掉 90 天沒玩的訪客（server/plugins/session-cleanup.ts）。看最後一次送成績的時間（last_played_at），
 * 不看 last_seen_at：只打開頁面、查名次也會更新 last_seen_at（2026-11-22 Codex 審查）
 */
export const PURGE_GUESTS_SQL = `DELETE FROM players WHERE kind = 'guest' AND julianday(COALESCE(last_played_at, created_at)) <= julianday('now', '-${GUEST_TTL_DAYS} days')`;

/**
 * 把訪客併進 Google 帳號（第 33 題，T13）：最佳紀錄取高分、完美次數相加、
 * 處理過的同步批次代碼搬過去（完美次數記 0，只用來擋重送，觸發器加的是 0），然後刪掉訪客（session、紀錄 CASCADE）。
 * 全部在一個 D1 batch 裡（同一個交易）。訪客已經不在（另一個請求剛併過）時每一句都不會做任何事，重複執行也不會多加。
 */
export async function mergeGuest(d1: D1Database, guestId: string, accountId: string) {
  const isGuest = "EXISTS (SELECT 1 FROM players WHERE id = ?2 AND kind = 'guest')";
  await d1.batch([
    d1
      .prepare(
        `INSERT INTO precise_stop_bests (player_id, mode, date_key, score, achieved_at)
         SELECT ?1, mode, date_key, score, achieved_at FROM precise_stop_bests WHERE player_id = ?2 AND ${isGuest}
         ON CONFLICT (player_id, mode, date_key) DO UPDATE SET score = excluded.score, achieved_at = excluded.achieved_at
         WHERE excluded.score > precise_stop_bests.score
           OR (excluded.score = precise_stop_bests.score AND excluded.achieved_at < precise_stop_bests.achieved_at)`,
      )
      .bind(accountId, guestId),
    d1
      .prepare(
        `INSERT OR IGNORE INTO precise_stop_sync_batches (player_id, sync_id, perfect_delta, created_at)
         SELECT ?1, sync_id, 0, created_at FROM precise_stop_sync_batches WHERE player_id = ?2 AND ${isGuest}`,
      )
      .bind(accountId, guestId),
    d1
      .prepare(
        `INSERT INTO precise_stop_stats (player_id, perfect_stops, updated_at)
         SELECT ?1, perfect_stops, updated_at FROM precise_stop_stats WHERE player_id = ?2 AND ${isGuest}
         ON CONFLICT (player_id) DO UPDATE SET perfect_stops = precise_stop_stats.perfect_stops + excluded.perfect_stops`,
      )
      .bind(accountId, guestId),
    // 下班逃離辦公室：只有最佳紀錄，取高分、同分留先創下的
    d1
      .prepare(
        `INSERT INTO office_escape_bests (player_id, mode, date_key, score, achieved_at)
         SELECT ?1, mode, date_key, score, achieved_at FROM office_escape_bests WHERE player_id = ?2 AND ${isGuest}
         ON CONFLICT (player_id, mode, date_key) DO UPDATE SET score = excluded.score, achieved_at = excluded.achieved_at
         WHERE excluded.score > office_escape_bests.score
           OR (excluded.score = office_escape_bests.score AND excluded.achieved_at < office_escape_bests.achieved_at)`,
      )
      .bind(accountId, guestId),
    // 一路向下：最高分與最深深度各取高值、同值留先創下的
    d1
      .prepare(
        `INSERT INTO mine_descent_bests (player_id, mode, score, achieved_at)
         SELECT ?1, mode, score, achieved_at FROM mine_descent_bests WHERE player_id = ?2 AND ${isGuest}
         ON CONFLICT (player_id, mode) DO UPDATE SET score = excluded.score, achieved_at = excluded.achieved_at
         WHERE excluded.score > mine_descent_bests.score
           OR (excluded.score = mine_descent_bests.score AND excluded.achieved_at < mine_descent_bests.achieved_at)`,
      )
      .bind(accountId, guestId),
    d1.prepare("DELETE FROM players WHERE id = ?1 AND kind = 'guest'").bind(guestId),
  ]);
}
