import { meResponse } from "@/lib/account/player";
import { validateSession } from "@/lib/account/session";

/** 前端取登入狀態。session 快到期時順便延長 cookie。 */
export default defineEventHandler((event) =>
  guarded(
    event,
    async () => {
      const token = sessionToken(event);
      const result = token ? await validateSession(useDb(event), token) : null;
      if (token && !result) clearSessionCookie(event);
      if (token && result?.renewedExpiresAt) setSessionCookie(event, token, result.renewedExpiresAt);
      return noStore(event, meResponse(result?.player ?? null));
    },
    { checkOrigin: false },
  ),
);
