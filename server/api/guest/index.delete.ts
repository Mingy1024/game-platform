/**
 * 刪除訪客紀錄（精準停車設計稿第 35 題，T15、T24）：刪掉這個瀏覽器的訪客和它的紀錄（CASCADE）、清掉 gs_guest。
 * 擋跨站請求（guarded 檢查 Origin）。
 * ?player=<前端以為的訪客>：和 cookie 的訪客不同時回 409 account_mismatch，什麼都不刪（另一個分頁換了身分）。
 * 已經沒有訪客（cookie 無效或已經刪過）也回成功，前端照樣清掉本機紀錄。
 */
export default defineEventHandler((event) =>
  guarded(
    event,
    async () => {
      const db = useDb(event);
      const guest = await guestPlayer(event, db);
      const expected = getQuery(event).player;
      if (guest && typeof expected === "string" && expected !== guest.id) return jsonError(event, 409, "account_mismatch");
      if (guest) await db.player.deleteMany({ where: { id: guest.id, kind: "guest" } });
      clearGuestCookie(event);
      return noStore(event, { ok: true });
    },
    { leaderboard: true },
  ),
);
