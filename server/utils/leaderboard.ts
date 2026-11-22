import {
  avatarColor,
  periodOf,
  pointsToTop,
  TOP_LIMIT,
  weekRange,
  type MineResponse,
  type Scope,
  type TopResponse,
} from "@/lib/games/precise-stop/leaderboard";

/**
 * 精準停車的全站排行查詢（設計稿第 14.1、14.3 節）。直接用 D1 的 SQL：
 * 本週榜要先取每個人的最高分再排，Prisma 寫不出來。
 *
 * 每張榜先整理成同一種「每人一列」的子查詢 entries(player_id, score, achieved_at)：
 * - daily：今天的今日挑戰（主鍵是 player_id＋mode＋date_key，本來就一人一列）
 * - week：本週每一天的今日挑戰，每人留分數最高、同分時最早創下的那一天（ROW_NUMBER）
 * - free：自由模式（date_key 是空字串）
 * achieved_at 是 Prisma 寫入的 ISO 字串（固定 +00:00、毫秒三位），字串順序就是時間順序。
 */
function entries(scope: Scope, now: number): { sql: string; params: string[] } {
  const period = periodOf(scope, now);
  if (scope === "week") {
    const { from, to } = weekRange(period);
    return {
      sql: `SELECT player_id, score, achieved_at FROM (
              SELECT player_id, score, achieved_at,
                ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY score DESC, achieved_at ASC) AS n
              FROM precise_stop_bests WHERE mode = 'daily' AND date_key BETWEEN ? AND ?
            ) WHERE n = 1`,
      params: [from, to],
    };
  }
  return {
    sql: "SELECT player_id, score, achieved_at FROM precise_stop_bests WHERE mode = ? AND date_key = ?",
    params: scope === "daily" ? ["daily", period] : ["free", ""],
  };
}

type TopSqlRow = {
  player_id: string;
  score: number;
  achieved_at: string;
  kind: string;
  nick_adj: number;
  nick_noun: number;
  nick_num: number;
  nick_custom: string | null;
};

/** 前 100 名和上榜人數。回應不帶玩家 ID 或任何個人資料（T5） */
export async function readTop(db: D1Database, scope: Scope, now: number): Promise<TopResponse> {
  const { sql, params } = entries(scope, now);
  const [rows, count] = await db.batch([
    db
      .prepare(
        `WITH e AS (${sql})
         SELECT e.player_id, e.score, e.achieved_at, p.kind, p.nick_adj, p.nick_noun, p.nick_num, p.nick_custom
         FROM e JOIN players p ON p.id = e.player_id
         ORDER BY e.score DESC, e.achieved_at ASC, e.player_id ASC LIMIT ${TOP_LIMIT}`,
      )
      .bind(...params),
    db.prepare(`WITH e AS (${sql}) SELECT COUNT(*) AS total FROM e`).bind(...params),
  ]);
  const total = ((count!.results[0] as { total?: number } | undefined)?.total ?? 0) as number;
  return {
    scope,
    period: periodOf(scope, now),
    total,
    rows: (rows!.results as TopSqlRow[]).map((row, index) => ({
      rank: index + 1,
      nick: { adj: row.nick_adj, noun: row.nick_noun, num: row.nick_num, custom: row.nick_custom },
      guest: row.kind === "guest",
      score: row.score,
      achievedAt: new Date(row.achieved_at).toISOString(),
      color: avatarColor(row.player_id),
    })),
  };
}

/**
 * 自己的名次：排在自己前面的人數＋1（分數比較高，或同分但比較早創下；同分同時間時用玩家 ID 決定，和前 100 名的順序一致）。
 * 每次現算、不快取（T5）。
 */
export async function readMine(db: D1Database, scope: Scope, playerId: string, now: number): Promise<MineResponse> {
  const { sql, params } = entries(scope, now);
  const row = await db
    .prepare(
      `WITH e AS (${sql}), me AS (SELECT score, achieved_at FROM e WHERE player_id = ?)
       SELECT
         (SELECT score FROM me) AS score,
         (SELECT COUNT(*) FROM e, me WHERE e.score > me.score
            OR (e.score = me.score AND (e.achieved_at < me.achieved_at OR (e.achieved_at = me.achieved_at AND e.player_id < ?)))) AS ahead,
         (SELECT COUNT(*) FROM e) AS total,
         (SELECT score FROM e ORDER BY score DESC, achieved_at ASC, player_id ASC LIMIT 1 OFFSET ${TOP_LIMIT - 1}) AS hundredth`,
    )
    .bind(...params, playerId, playerId)
    .first<{ score: number | null; ahead: number; total: number; hundredth: number | null }>();
  const total = row?.total ?? 0;
  if (!row || row.score === null) return { rank: null, score: null, total, toTop100: null };
  const rank = row.ahead + 1;
  return { rank, score: row.score, total, toTop100: pointsToTop(row.score, rank, row.hundredth) };
}
