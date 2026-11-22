import { getQuery, getRequestURL, setResponseHeader } from "h3";
import { isScope, periodOf, TOP_CACHE_SECONDS, type TopResponse } from "@/lib/games/precise-stop/leaderboard";

/**
 * 前 100 名（精準停車設計稿第 14.3 節，T1–T5）：?scope=daily|week|free
 * 回應 { scope, period, total, rows: [{ rank, nick, guest, score, achievedAt, color }] }，不帶玩家 ID 或任何個人資料。
 *
 * 依榜和期間（今天的日期、本週的週一）存在 Cloudflare 的邊緣快取 60 秒（第 34 題）：換日、換週時 key 不同，自動是新的一份。
 * 用 Workers 的 Cache API（caches.default）；本機 nuxt dev 和 *.workers.dev 網域沒有邊緣快取，每次都查資料庫。
 * X-Leaderboard-Cache 標頭寫 hit／miss，方便檢查。
 */
type EdgeCache = { match(request: Request): Promise<Response | undefined>; put(request: Request, response: Response): Promise<void> };
const edgeCache = (): EdgeCache | null => {
  const store = (globalThis as { caches?: { default?: EdgeCache } }).caches?.default;
  return store && typeof store.match === "function" ? store : null;
};

export default defineEventHandler((event) =>
  guarded(
    event,
    async () => {
      const scope = getQuery(event).scope;
      if (!isScope(scope)) return jsonError(event, 400, "bad_request");
      const now = Date.now();
      const key = new Request(new URL(`/__edge-cache/precise-stop/leaderboard/${scope}/${periodOf(scope, now) || "all"}`, getRequestURL(event).origin));
      const cache = edgeCache();

      let body: TopResponse | null = null;
      const hit = await cache?.match(key).catch(() => undefined);
      if (hit) body = (await hit.json().catch(() => null)) as TopResponse | null;
      setResponseHeader(event, "X-Leaderboard-Cache", body ? "hit" : "miss");
      if (!body) {
        body = await readTop(useD1(event), scope, now);
        const stored = new Response(JSON.stringify(body), {
          headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${TOP_CACHE_SECONDS}` },
        });
        await cache?.put(key, stored).catch((error) => console.error("排行榜快取寫入失敗", error));
      }
      // 瀏覽器不另外快取：60 秒的快取只在 Cloudflare
      setResponseHeader(event, "Cache-Control", "no-cache");
      return body;
    },
    { checkOrigin: false, leaderboard: true },
  ),
);
