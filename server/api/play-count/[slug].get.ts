import { getRouterParam } from "h3";
import { isPlayCountGame, readPlayCount } from "@/lib/play-count";

/**
 * 讀取一款遊戲的累計遊玩次數：GET /api/play-count/<slug>，回應 { count }（沒人玩完過是 0）。
 * 沒有任何寫入副作用。要不要顯示（少於 100 不顯示）由前端判斷（lib/play-count 的 shouldShowPlayCount）。
 * 錯誤：404 not_found（功能關閉或不是站上的遊戲）、500 server。
 */
export default defineEventHandler((event) =>
  guarded(
    event,
    async () => {
      const slug = getRouterParam(event, "slug");
      if (!isPlayCountGame(slug)) return jsonError(event, 404, "not_found");
      return noStore(event, { count: await readPlayCount(useD1(event), slug) });
    },
    { checkOrigin: false, playCount: true },
  ),
);
