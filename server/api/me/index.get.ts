import { guestInfo, meResponse } from "@/lib/account/player";
import { FLAGS } from "@/lib/flags";

/**
 * 前端取登入狀態。session 快到期時順便延長 cookie。
 * 排行榜打開時（精準停車設計稿第 14.3 節）：
 * - 用 Google 登入又帶著訪客 cookie：先把訪客併進帳號再回應；併失敗照常回應，cookie 留著下次再併（T13）
 * - 沒登入 Google：多帶 guest（這個瀏覽器的訪客或 null）和 consentRequired（T11）
 */
export default defineEventHandler((event) =>
  guarded(
    event,
    async () => {
      const db = useDb(event);
      const google = await googlePlayer(event, db);
      if (google) {
        if (FLAGS.leaderboard) await absorbGuest(event, db, google.id);
        return noStore(event, meResponse(google));
      }
      if (!FLAGS.leaderboard) return noStore(event, meResponse(null));
      const guest = await guestPlayer(event, db);
      return noStore(event, { loggedIn: false as const, guest: guest ? guestInfo(guest) : null, consentRequired: consentRequired(event) });
    },
    { checkOrigin: false },
  ),
);
