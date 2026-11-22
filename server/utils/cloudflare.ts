import type { H3Event } from "h3";

/**
 * Cloudflare 的 binding（wrangler.jsonc）。Nitro 把它放在 event.context.cloudflare.env：
 * Workers 上是真的 binding；nuxt dev 時由 wrangler 的 getPlatformProxy 提供本機版本。
 */
export function cloudflareEnv(event: H3Event): Partial<CloudflareEnv> {
  return (event.context.cloudflare?.env ?? {}) as Partial<CloudflareEnv>;
}

/** D1 binding 本身（需要 batch 或 Prisma 寫不出來的 SQL 時用） */
export function useD1(event: H3Event): D1Database {
  const db = cloudflareEnv(event).DB;
  if (!db) throw new Error("沒有 D1 binding（DB）：請確認 wrangler.jsonc，並用 nuxt dev 或 wrangler dev 執行");
  return db;
}

/** 連到 D1 的 Prisma Client */
export function useDb(event: H3Event) {
  return prismaFor(useD1(event));
}
