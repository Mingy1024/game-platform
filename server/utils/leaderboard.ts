import {
  avatarColor,
  periodOf,
  pointsToTop,
  TOP_LIMIT,
  weekRange,
  type MineResponse,
  type Scope,
  type TopResponse,
  type TopRow,
} from "@/lib/games/precise-stop/leaderboard";
import { periodOf as officePeriodOf, type Scope as OfficeScope, type TopResponse as OfficeTopResponse } from "@/lib/games/office-escape/leaderboard";
import { periodOf as minePeriodOf, type Scope as MineScope, type TopResponse as MineTopResponse } from "@/lib/games/mine-descent/leaderboard";
import {
  periodOf as monkPeriodOf,
  type MineResponse as MonkMineResponse,
  type Scope as MonkScope,
  type TopResponse as MonkTopResponse,
} from "@/lib/games/monk-soup-tower/leaderboard";

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
/** 一款遊戲的最佳紀錄表。allMode 是「歷史最佳」那一種的 mode 值（date_key 一律是空字串） */
export type Board = { table: string; allMode: string; /** 沒有 date_key 欄位，榜的名稱（scope）就是 mode（礦坑大逃亡） */ byScope?: boolean };
export const PRECISE_STOP_BOARD: Board = { table: "precise_stop_bests", allMode: "free" };
export const OFFICE_ESCAPE_BOARD: Board = { table: "office_escape_bests", allMode: "all" };
export const MINE_DESCENT_BOARD: Board = { table: "mine_descent_bests", allMode: "", byScope: true };

/** period：這張榜現在的期間（daily 是今天、week 是本週週一、其餘是空字串） */
function entries(board: Board, scope: string, period: string): { sql: string; params: string[] } {
  if (board.byScope) return { sql: `SELECT player_id, score, achieved_at FROM ${board.table} WHERE mode = ?`, params: [scope] };
  if (scope === "week") {
    const { from, to } = weekRange(period);
    return {
      sql: `SELECT player_id, score, achieved_at FROM (
              SELECT player_id, score, achieved_at,
                ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY score DESC, achieved_at ASC) AS n
              FROM ${board.table} WHERE mode = 'daily' AND date_key BETWEEN ? AND ?
            ) WHERE n = 1`,
      params: [from, to],
    };
  }
  return {
    sql: `SELECT player_id, score, achieved_at FROM ${board.table} WHERE mode = ? AND date_key = ?`,
    params: scope === "daily" ? ["daily", period] : [board.allMode, ""],
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
async function readBoardTop(db: D1Database, board: Board, scope: string, period: string): Promise<{ total: number; rows: TopRow[] }> {
  const { sql, params } = entries(board, scope, period);
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
async function readBoardMine(db: D1Database, board: Board, scope: string, period: string, playerId: string): Promise<MineResponse> {
  const { sql, params } = entries(board, scope, period);
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

export async function readTop(db: D1Database, scope: Scope, now: number): Promise<TopResponse> {
  const period = periodOf(scope, now);
  return { scope, period, ...(await readBoardTop(db, PRECISE_STOP_BOARD, scope, period)) };
}

export const readMine = (db: D1Database, scope: Scope, playerId: string, now: number): Promise<MineResponse> =>
  readBoardMine(db, PRECISE_STOP_BOARD, scope, periodOf(scope, now), playerId);

/** 下班逃離辦公室的前 100 名與自己的名次：同一套查詢，換成它自己的表 */
export async function readOfficeTop(db: D1Database, scope: OfficeScope, now: number): Promise<OfficeTopResponse> {
  const period = officePeriodOf(scope, now);
  return { scope, period, ...(await readBoardTop(db, OFFICE_ESCAPE_BOARD, scope, period)) };
}

export const readOfficeMine = (db: D1Database, scope: OfficeScope, playerId: string, now: number): Promise<MineResponse> =>
  readBoardMine(db, OFFICE_ESCAPE_BOARD, scope, officePeriodOf(scope, now), playerId);

/** 礦坑大逃亡的前 100 名與自己的名次：同一套查詢，換成它自己的表（scope 就是 mode：score／depth） */
export async function readMineTop(db: D1Database, scope: MineScope, now: number): Promise<MineTopResponse> {
  const period = minePeriodOf(scope, now);
  return { scope, period, ...(await readBoardTop(db, MINE_DESCENT_BOARD, scope, period)) };
}

export const readMineMine = (db: D1Database, scope: MineScope, playerId: string, now: number): Promise<MineResponse> =>
  readBoardMine(db, MINE_DESCENT_BOARD, scope, minePeriodOf(scope, now), playerId);

/**
 * 和尚端湯上塔的前 100 名與自己的名次（T1–T5）。只有固定關卡一張榜。
 * 排序多一層：分數高的在前、同分時間短的在前、再同先創下的在前（T2），所以不共用上面的查詢。
 */
type MonkSqlRow = TopSqlRow & { time_ms: number };

export async function readMonkTop(db: D1Database, scope: MonkScope, _now: number): Promise<MonkTopResponse> {
  const [rows, count] = await db.batch([
    db
      .prepare(
        `SELECT e.player_id, e.score, e.time_ms, e.achieved_at, p.kind, p.nick_adj, p.nick_noun, p.nick_num, p.nick_custom
         FROM monk_soup_tower_bests e JOIN players p ON p.id = e.player_id
         WHERE e.mode = ?
         ORDER BY e.score DESC, e.time_ms ASC, e.achieved_at ASC, e.player_id ASC LIMIT ${TOP_LIMIT}`,
      )
      .bind(scope),
    db.prepare("SELECT COUNT(*) AS total FROM monk_soup_tower_bests WHERE mode = ?").bind(scope),
  ]);
  const total = ((count!.results[0] as { total?: number } | undefined)?.total ?? 0) as number;
  return {
    scope,
    period: monkPeriodOf(scope, _now),
    total,
    rows: (rows!.results as MonkSqlRow[]).map((row, index) => ({
      rank: index + 1,
      nick: { adj: row.nick_adj, noun: row.nick_noun, num: row.nick_num, custom: row.nick_custom },
      guest: row.kind === "guest",
      score: row.score,
      timeMs: row.time_ms,
      achievedAt: new Date(row.achieved_at).toISOString(),
      color: avatarColor(row.player_id),
    })),
  };
}

export async function readMonkMine(db: D1Database, scope: MonkScope, playerId: string, _now: number): Promise<MonkMineResponse> {
  const row = await db
    .prepare(
      `WITH e AS (SELECT player_id, score, time_ms, achieved_at FROM monk_soup_tower_bests WHERE mode = ?),
            me AS (SELECT score, time_ms, achieved_at FROM e WHERE player_id = ?)
       SELECT
         (SELECT score FROM me) AS score,
         (SELECT time_ms FROM me) AS time_ms,
         (SELECT COUNT(*) FROM e, me WHERE e.score > me.score
            OR (e.score = me.score AND (e.time_ms < me.time_ms
              OR (e.time_ms = me.time_ms AND (e.achieved_at < me.achieved_at OR (e.achieved_at = me.achieved_at AND e.player_id < ?)))))) AS ahead,
         (SELECT COUNT(*) FROM e) AS total,
         (SELECT score FROM e ORDER BY score DESC, time_ms ASC, achieved_at ASC, player_id ASC LIMIT 1 OFFSET ${TOP_LIMIT - 1}) AS hundredth`,
    )
    .bind(scope, playerId, playerId)
    .first<{ score: number | null; time_ms: number | null; ahead: number; total: number; hundredth: number | null }>();
  const total = row?.total ?? 0;
  if (!row || row.score === null) return { rank: null, score: null, timeMs: null, total, toTop100: null };
  const rank = row.ahead + 1;
  return { rank, score: row.score, timeMs: row.time_ms, total, toTop100: pointsToTop(row.score, rank, row.hundredth) };
}
