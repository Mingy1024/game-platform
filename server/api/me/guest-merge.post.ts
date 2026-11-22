/**
 * 把這個瀏覽器的訪客併進目前登入的 Google 帳號（精準停車設計稿第 33 題，T13）。
 * 登入回來時已經併過一次；那次失敗、cookie 還留著時，前端讀到 /api/me 的 guestPending 才呼叫這裡重試。
 * 會改資料，所以是 POST 並檢查 Origin。沒有訪客 cookie 時什麼都不做。
 * 回應 { ok: true }；併的時候失敗回 503（cookie 留著，下次再試）。
 */
export default defineEventHandler((event) =>
  guarded(
    event,
    async () => {
      const db = useDb(event);
      const player = await requireSessionPlayer(event, db);
      if (!(await absorbGuest(event, db, player.id))) return jsonError(event, 503, "unavailable");
      return noStore(event, { ok: true });
    },
    { leaderboard: true },
  ),
);
