import { PURGE_GUESTS_SQL } from "@/lib/account/guest-merge";

/**
 * 每日排程（wrangler.jsonc 的 triggers.crons，台灣時間凌晨 3 點）：
 * - 清掉過期的 session
 * - 刪掉 90 天沒玩的排行榜訪客（精準停車設計稿第 14.2 節，T16）。紀錄、session 用 ON DELETE CASCADE 一起刪
 * Nitro 的 cloudflare_module 會把 Workers 的 scheduled 事件轉成 cloudflare:scheduled hook。
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("cloudflare:scheduled", async ({ env }) => {
    const db = (env as Partial<CloudflareEnv>).DB;
    if (!db) return;
    const [sessions, guests] = await db.batch([
      db.prepare("DELETE FROM sessions WHERE julianday(expires_at) <= julianday('now')"),
      db.prepare(PURGE_GUESTS_SQL),
    ]);
    console.log(`清除過期 session：${sessions!.meta.changes} 筆；90 天沒玩的訪客：${guests!.meta.changes} 位`);
  });
});
