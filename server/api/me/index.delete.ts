/**
 * 刪除帳號：刪掉玩家、他所有的 session（資料表設了 ON DELETE CASCADE），
 * 各遊戲的紀錄表（precise_stop_bests、precise_stop_stats）也用 CASCADE 一起刪（P14）。
 */
export default defineEventHandler((event) =>
  guarded(event, async () => {
    const db = useDb(event);
    const player = await googlePlayer(event, db);
    if (!player) return jsonError(event, 401, "unauthorized");
    await db.player.deleteMany({ where: { id: player.id } });
    clearSessionCookie(event);
    return noStore(event, { ok: true });
  }),
);
