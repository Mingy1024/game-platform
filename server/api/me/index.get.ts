import { getCookie } from "h3";
import { GUEST_COOKIE } from "@/lib/account/guest";
import { guestInfo, meResponse } from "@/lib/account/player";
import { FLAGS } from "@/lib/flags";

/**
 * 前端取登入狀態。session 快到期時順便延長 cookie。只讀取，不做合併、刪除這類寫入：
 * SameSite=Lax 的 cookie 在外站的頂層連結也會帶上（docs/dev/sync-checklist.md 第 1 節，2026-11-22 Codex 審查）。
 * 排行榜打開時（精準停車設計稿第 14.3 節）：
 * - 用 Google 登入又帶著訪客 cookie（登入時沒併成功）：回 guestPending: true，前端再用 POST /api/me/guest-merge 併（T13）
 * - 沒登入 Google：多帶 guest（這個瀏覽器的訪客或 null）和 consentRequired（T11）
 */
export default defineEventHandler((event) =>
  guarded(
    event,
    async () => {
      const db = useDb(event);
      const google = await googlePlayer(event, db);
      if (google) {
        const pending = FLAGS.leaderboard && !!getCookie(event, GUEST_COOKIE);
        return noStore(event, pending ? { ...meResponse(google), guestPending: true } : meResponse(google));
      }
      if (!FLAGS.leaderboard) return noStore(event, meResponse(null));
      const guest = await guestPlayer(event, db);
      return noStore(event, { loggedIn: false as const, guest: guest ? guestInfo(guest) : null, consentRequired: consentRequired(event) });
    },
    { checkOrigin: false },
  ),
);
