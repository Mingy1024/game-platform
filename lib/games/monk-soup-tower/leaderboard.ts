import { z } from "zod";
import {
  AVATAR_COLORS,
  TOP_CACHE_SECONDS,
  TOP_LIMIT,
  TOP_PREVIEW,
  avatarColor,
  pointsToTop,
  type TopRow as BaseRow,
} from "../precise-stop/leaderboard";

/**
 * 和尚端湯上塔的全站排行（T 組）：前端和伺服器共用的規則與格式。純邏輯。
 * 只有一張榜：固定關卡的歷史最佳（隨機模式每座塔不同，不上榜，T1）。
 * 排序：分數高的在前；同分時間短的在前；再同先創下的在前。每人一列（T2）。
 * 名次列、頭像色、名次差距的算法沿用精準停車，每列多帶總時間。
 */
export { AVATAR_COLORS, TOP_CACHE_SECONDS, TOP_LIMIT, TOP_PREVIEW, avatarColor, pointsToTop };

export const SCOPES = ["fixed"] as const;
export type Scope = (typeof SCOPES)[number];
export const isScope = (value: unknown): value is Scope => typeof value === "string" && (SCOPES as readonly string[]).includes(value);

/** 一列：比精準停車多一個總時間 */
export type TopRow = BaseRow & { timeMs: number };
export type TopResponse = { scope: Scope; period: string; total: number; rows: TopRow[] };
/** 自己的名次。這張榜沒有成績時 rank、score、timeMs 是 null */
export type MineResponse = { rank: number | null; score: number | null; timeMs: number | null; total: number; toTop100: number | null };

/** 歷史最佳，沒有期間：回傳空字串（快取的 key 也用它） */
export const periodOf = (_scope: Scope, _now: number): string => "";

const nick = z.object({
  adj: z.number().int().min(0),
  noun: z.number().int().min(0),
  num: z.number().int().min(0),
  custom: z.string().nullable(),
});
const topSchema = z.object({
  scope: z.enum(SCOPES),
  period: z.string(),
  total: z.number().int().min(0),
  rows: z
    .array(
      z.object({
        rank: z.number().int().min(1),
        nick,
        guest: z.boolean(),
        score: z.number().int().min(0),
        timeMs: z.number().int().min(0),
        achievedAt: z.string(),
        color: z.number().int().min(0),
      }),
    )
    .max(TOP_LIMIT),
});
const mineSchema = z.object({
  rank: z.number().int().min(1).nullable(),
  score: z.number().int().min(0).nullable(),
  timeMs: z.number().int().min(0).nullable(),
  total: z.number().int().min(0),
  toTop100: z.number().int().min(1).nullable(),
});

/** 伺服器回應的格式檢查；不對就當作讀不到（T6） */
export const parseTop = (raw: unknown): TopResponse | null => (topSchema.safeParse(raw).data ?? null) as TopResponse | null;
export const parseMine = (raw: unknown): MineResponse | null => mineSchema.safeParse(raw).data ?? null;
