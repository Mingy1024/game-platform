import { guestInfo } from "@/lib/account/player";
import { FLAGS } from "@/lib/flags";

/**
 * 取得帳號（或訪客）裡的精準停車紀錄（P3）。沒有身分回 401。
 * ?player=<前端以為的身分>：和目前的不同時回 409 account_mismatch（另一個分頁換了帳號）。
 * 回應：{ daily: { "YYYY-MM-DD": 分數 }（最近 14 天）, free, perfectStops }；訪客另外帶 guest
 */
export default defineEventHandler((event) =>
  guarded(
    event,
    async () => {
      const db = useDb(event);
      // 唯讀的身分查詢：GET 不續期、不動 cookie（docs/plans/sync-hardening.md #4）
      const identity = await readIdentity(event, db, FLAGS.leaderboard);
      if (identity.kind === "none") return jsonError(event, 401, "unauthorized");
      const player = identity.player;
      const expected = getQuery(event).player;
      if (typeof expected === "string" && expected !== player.id) return jsonError(event, 409, "account_mismatch");
      const records = await readAccountRecords(db, player.id, Date.now());
      return noStore(event, player.kind === "guest" ? { ...records, guest: guestInfo(player) } : records);
    },
    { checkOrigin: false },
  ),
);
