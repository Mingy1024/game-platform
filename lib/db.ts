import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaClient } from "@/generated/prisma/client";

const clients = new WeakMap<D1Database, PrismaClient>();

/**
 * 取得連到 D1 的 Prisma Client（伺服器端）。
 * Workers 上每個 D1 binding 物件共用一個 client；本機 next dev 由
 * next.config.ts 的 initOpenNextCloudflareForDev 提供本機 D1（.wrangler/state）。
 */
export function getDb(): PrismaClient {
  const { env } = getCloudflareContext();
  let client = clients.get(env.DB);
  if (!client) {
    client = new PrismaClient({ adapter: new PrismaD1(env.DB) });
    clients.set(env.DB, client);
  }
  return client;
}
