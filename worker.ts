/**
 * Cloudflare Worker 的進入點：網站本身交給 OpenNext 產生的 worker，
 * 另外加上每日排程（wrangler.jsonc 的 triggers.crons）。
 * 要先跑 opennextjs-cloudflare build 產生 .open-next/worker.js。
 */
// 建置後才會產生，乾淨的專案裡找不到這個檔案
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { default as handler } from "./.open-next/worker.js";

export default {
  fetch: handler.fetch,

  /** 每天清掉過期的 session（台灣時間凌晨 3 點） */
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(
      env.DB.prepare("DELETE FROM sessions WHERE julianday(expires_at) <= julianday('now')")
        .run()
        .then((result) => console.log(`清除過期 session：${result.meta.changes} 筆`)),
    );
  },
} satisfies ExportedHandler<CloudflareEnv>;

// OpenNext 的 Durable Object（目前沒用到，照官方範本一起匯出）
// 建置後才會產生，乾淨的專案裡找不到這個檔案
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";
