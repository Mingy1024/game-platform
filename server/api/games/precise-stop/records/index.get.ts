/**
 * 取得帳號裡的精準停車紀錄（P3）。沒登入回 401。
 * ?player=<前端以為登入的帳號>：和目前登入的不同時回 409 account_mismatch（另一個分頁換了帳號）。
 * 回應：{ daily: { "YYYY-MM-DD": 分數 }（最近 14 天）, free, perfectStops }
 */
export default defineEventHandler((event) =>
  guarded(
    event,
    async () => {
      const db = useDb(event);
      const player = await requireSessionPlayer(event, db);
      const expected = getQuery(event).player;
      if (typeof expected === "string" && expected !== player.id) return jsonError(event, 409, "account_mismatch");
      return noStore(event, await readAccountRecords(db, player.id, Date.now()));
    },
    { checkOrigin: false },
  ),
);
