import { z } from "zod";
import type { Nick } from "@/lib/account/nick/nick";
import { taiwanDateKey } from "./route";

/**
 * 精準停車的全站排行（設計稿第 14 節，T 組）：前端和伺服器共用的規則與格式。純邏輯。
 *
 * - daily：今天（台灣日期）每個人的今日挑戰最佳分
 * - week：本週（台灣時間週一 0 點到週日 24 點）今日挑戰的單局最高分（第 30 題）
 * - free：自由模式的歷史最佳分
 * 排序：分數高的在前；同分時先創下的在前。每個人在每張榜只出現一次（T1、T2）。
 */
export const SCOPES = ["daily", "week", "free"] as const;
export type Scope = (typeof SCOPES)[number];
export const isScope = (value: unknown): value is Scope => typeof value === "string" && (SCOPES as readonly string[]).includes(value);

/** 前 100 名（T3）；畫面先顯示前 10 名 */
export const TOP_LIMIT = 100;
export const TOP_PREVIEW = 10;
/** 前 100 名在 Cloudflare 快取的秒數（第 34 題，T5） */
export const TOP_CACHE_SECONDS = 60;

/** 頭像字的底色：由玩家 ID 決定，回應只帶編號、不帶 ID（T5 不含個人資料） */
export const AVATAR_COLORS = ["#cc4409", "#1d3a8f", "#16794f", "#a83606", "#4a5263", "#152b6b"] as const;

export function avatarColor(playerId: string): number {
  let hash = 0;
  for (let i = 0; i < playerId.length; i++) hash = (hash * 31 + playerId.charCodeAt(i)) >>> 0;
  return hash % AVATAR_COLORS.length;
}

const DAY_MS = 86_400_000;

/** 這個台灣日期所在那一週的週一和週日（YYYY-MM-DD） */
export function weekRange(dateKey: string): { from: string; to: string } {
  const date = new Date(`${dateKey}T00:00:00Z`);
  // getUTCDay：0 是週日。週一是一週的第一天
  const offset = (date.getUTCDay() + 6) % 7;
  const monday = date.getTime() - offset * DAY_MS;
  return { from: new Date(monday).toISOString().slice(0, 10), to: new Date(monday + 6 * DAY_MS).toISOString().slice(0, 10) };
}

/** 這張榜現在的期間：daily 是今天、week 是本週的週一、free 是空字串。快取的 key 也用它，換日、換週時自動是新的一份 */
export function periodOf(scope: Scope, now: number): string {
  const today = taiwanDateKey(now);
  if (scope === "daily") return today;
  if (scope === "week") return weekRange(today).from;
  return "";
}

/** 榜上的一列。nick 是編號（每種語言顯示自己的翻譯）；color 是 AVATAR_COLORS 的編號 */
export type TopRow = { rank: number; nick: Nick; guest: boolean; score: number; achievedAt: string; color: number };
export type TopResponse = { scope: Scope; period: string; total: number; rows: TopRow[] };
/** 自己的名次。這張榜沒有成績時 rank、score 是 null；toTop100 是在 100 名外時還差幾分 */
export type MineResponse = { rank: number | null; score: number | null; total: number; toTop100: number | null };

/** 在 100 名外時，再幾分可以進前 100 名：要比第 100 名多 1 分（同分時先創下的在前，之後才達成的一定排在後面） */
export function pointsToTop(score: number, rank: number, hundredth: number | null): number | null {
  if (rank <= TOP_LIMIT || hundredth === null) return null;
  return Math.max(1, hundredth - score + 1);
}

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
export const parseTop = (raw: unknown): TopResponse | null => topSchema.safeParse(raw).data ?? null;
export const parseMine = (raw: unknown): MineResponse | null => mineSchema.safeParse(raw).data ?? null;
