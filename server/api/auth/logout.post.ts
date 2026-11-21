import { deleteSession } from "@/lib/account/session";

/** 登出：刪掉這個 session 和 cookie */
export default defineEventHandler((event) =>
  guarded(event, async () => {
    const token = sessionToken(event);
    if (token) await deleteSession(useDb(event), token);
    clearSessionCookie(event);
    return noStore(event, { ok: true });
  }),
);
