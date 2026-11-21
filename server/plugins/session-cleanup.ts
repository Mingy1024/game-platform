/**
 * 每日排程（wrangler.jsonc 的 triggers.crons，台灣時間凌晨 3 點）：清掉過期的 session。
 * Nitro 的 cloudflare_module 會把 Workers 的 scheduled 事件轉成 cloudflare:scheduled hook。
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("cloudflare:scheduled", async ({ env }) => {
    const db = (env as Partial<CloudflareEnv>).DB;
    if (!db) return;
    const result = await db.prepare("DELETE FROM sessions WHERE julianday(expires_at) <= julianday('now')").run();
    console.log(`清除過期 session：${result.meta.changes} 筆`);
  });
});
