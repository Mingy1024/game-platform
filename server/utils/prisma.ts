import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaClient } from "@/generated/prisma/client";

const clients = new WeakMap<D1Database, PrismaClient>();

/**
 * 連到 D1 的 Prisma Client（伺服器端）。每個 D1 binding 物件共用一個 client。
 * binding 由 useDb（server/utils/cloudflare.ts）從請求取得：Workers 上是正式或預覽的 D1，
 * 本機 nuxt dev 是 wrangler 提供的本機 D1（.wrangler/state）。
 */
export function prismaFor(db: D1Database): PrismaClient {
  let client = clients.get(db);
  if (!client) {
    client = new PrismaClient({ adapter: new PrismaD1(db) });
    clients.set(db, client);
  }
  return client;
}
