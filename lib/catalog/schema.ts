import { z } from "zod";

/** 遊戲目錄契約，對應規劃文件第 7 節。 */
export const gameManifestSchema = z.object({
  /** 永久識別值，不隨標題變更 */
  id: z.string().min(1),
  /** 小寫英數與連字號，全站唯一 */
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1),
  summary: z.string().min(1),
  categories: z.array(z.string()).min(1),
  tags: z.array(z.string()),
  cover: z.string().startsWith("/"),
  /** 大張主視覺（直式），首頁主推區與介紹頁使用 */
  hero: z.string().startsWith("/"),
  contentPath: z.string().min(1),
  status: z.enum(["draft", "published", "archived"]),
  /** ISO 8601 */
  publishedAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  /** 遊戲程式／資產版本 */
  version: z.string().min(1),
  /** 計分規則不相容時更換 */
  scoringVersion: z.string().min(1),
  engine: z.enum(["phaser", "canvas", "dom"]),
  orientation: z.enum(["portrait", "landscape", "any"]),
  inputs: z.array(z.enum(["touch", "keyboard", "mouse", "motion"])).min(1),
  aspectRatio: z.number().positive(),
  featured: z.boolean(),
  scoreOrder: z.enum(["asc", "desc"]),
  scoreUnit: z.string(),
});

export type GameManifest = z.infer<typeof gameManifestSchema>;
