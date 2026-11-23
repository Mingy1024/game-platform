import { z } from "zod";
import {
  AVATAR_COLORS,
  TOP_CACHE_SECONDS,
  TOP_LIMIT,
  TOP_PREVIEW,
  avatarColor,
  pointsToTop,
  weekRange,
  type MineResponse,
  type TopRow,
} from "../precise-stop/leaderboard";
/**
 * 一路向下的全站排行（T 組）：前端和伺服器共用的規則與格式。純邏輯。
 * - score：每個人的最高分
 * - depth：每個人最深的深度（公尺）
 * 排序：數值高的在前；同值時先創下的在前。每個人在每張榜只出現一次（T2）。
 * 名次列、頭像色、名次差距的算法和精準停車完全一致，直接沿用（rows 裡的 score 欄位在深度榜是公尺數）。
 */
export { AVATAR_COLORS, TOP_CACHE_SECONDS, TOP_LIMIT, TOP_PREVIEW, avatarColor, pointsToTop, weekRange };
export type { MineResponse, TopRow };

export const SCOPES = ["score", "depth"] as const;
export type Scope = (typeof SCOPES)[number];
export const isScope = (value: unknown): value is Scope => typeof value === "string" && (SCOPES as readonly string[]).includes(value);

/** 沒有期間（兩張榜都是歷史最佳）：回傳空字串，快取的 key 也用它 */
export const periodOf = (_scope: Scope, _now: number): string => "";

export type TopResponse = { scope: Scope; period: string; total: number; rows: TopRow[] };

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
        achievedAt: z.string(),
        color: z.number().int().min(0),
      }),
    )
    .max(TOP_LIMIT),
});
const mineSchema = z.object({
  rank: z.number().int().min(1).nullable(),
  score: z.number().int().min(0).nullable(),
  total: z.number().int().min(0),
  toTop100: z.number().int().min(1).nullable(),
});

/** 伺服器回應的格式檢查；不對就當作讀不到（T7） */
export const parseTop = (raw: unknown): TopResponse | null => (topSchema.safeParse(raw).data ?? null) as TopResponse | null;
export const parseMine = (raw: unknown): MineResponse | null => mineSchema.safeParse(raw).data ?? null;
