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
import { taiwanDateKey } from "./route";

/**
 * 下班逃離辦公室的全站排行（T 組）：前端和伺服器共用的規則與格式。純邏輯。
 * - daily：今天（台灣日期）每個人的最佳分
 * - week：本週（台灣時間週一 0 點到週日 24 點）每日最佳中的最高分
 * - all：歷史最佳
 * 排序：分數高的在前；同分時先創下的在前。每個人在每張榜只出現一次（T2）。
 * 名次列、頭像色、名次差距的算法和精準停車完全一致，直接沿用。
 */
export { AVATAR_COLORS, TOP_CACHE_SECONDS, TOP_LIMIT, TOP_PREVIEW, avatarColor, pointsToTop, weekRange };
export type { MineResponse, TopRow };

export const SCOPES = ["daily", "week", "all"] as const;
export type Scope = (typeof SCOPES)[number];
export const isScope = (value: unknown): value is Scope => typeof value === "string" && (SCOPES as readonly string[]).includes(value);

/** 這張榜現在的期間：daily 是今天、week 是本週的週一、all 是空字串（快取的 key 也用它，換日換週自動是新的一份） */
export function periodOf(scope: Scope, now: number): string {
  const today = taiwanDateKey(now);
  if (scope === "daily") return today;
  if (scope === "week") return weekRange(today).from;
  return "";
}

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
