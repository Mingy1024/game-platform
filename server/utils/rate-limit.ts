import type { H3Event } from "h3";

type LimiterName = "NICK_LIMITER" | "RECORDS_LIMITER";

/**
 * 同一個人在一段時間內的請求次數上限（wrangler.jsonc 的 ratelimits）。
 * Cloudflare 的限流是各資料中心分開計數，不是全域精確的上限，用來擋連續送出已經足夠。
 *
 * - "ok"：可以繼續
 * - "limited"：超過次數
 * - "unavailable"：正式環境沒有 binding 或 binding 出錯（記錄下來、拒絕請求，不默默放行）
 * 本機開發沒有 binding 時不限制。
 */
export async function checkRateLimit(event: H3Event, name: LimiterName, key: string): Promise<"ok" | "limited" | "unavailable"> {
  const limiter = cloudflareEnv(event)[name];
  if (!limiter) {
    if (import.meta.dev) return "ok";
    console.error(`${name} binding 不存在：請確認 wrangler.jsonc 的 ratelimits`);
    return "unavailable";
  }
  try {
    return (await limiter.limit({ key })).success ? "ok" : "limited";
  } catch (error) {
    console.error(`${name} 呼叫失敗`, error);
    return "unavailable";
  }
}
