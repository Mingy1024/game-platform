import { validateSession } from "@/lib/account/session";

/**
 * 刪除帳號：刪掉玩家、他所有的 session（資料表設了 ON DELETE CASCADE），
 * 之後各遊戲的紀錄表也用 CASCADE 一起刪。
 */
export default defineEventHandler((event) =>
  guarded(event, async () => {
    const token = sessionToken(event);
    const db = useDb(event);
    const result = token ? await validateSession(db, token) : null;
    if (!result) return jsonError(event, 401, "unauthorized");
    await db.player.delete({ where: { id: result.player.id } });
    clearSessionCookie(event);
    return noStore(event, { ok: true });
  }),
);
