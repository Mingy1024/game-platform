import { guestInfo } from "@/lib/account/player";
import { FLAGS } from "@/lib/flags";

/**
 * 取得帳號（或訪客）裡的下班逃離辦公室紀錄（P2）。沒有身分回 401。
 * ?player=<前端以為的身分>：和目前的不同時回 409 account_mismatch（另一個分頁換了帳號）。
 * 回應：{ daily: { "YYYY-MM-DD": 分數 }（最近 14 天）, best }；訪客另外帶 guest。GET 沒有任何寫入副作用。
 */
export default defineEventHandler((event) =>
  guarded(
    event,
    async () => {
      const db = useDb(event);
      const google = await googlePlayer(event, db);
      const player = google ?? (FLAGS.leaderboard ? await guestPlayer(event, db) : null);
      if (!player) return jsonError(event, 401, "unauthorized");
      const expected = getQuery(event).player;
      if (typeof expected === "string" && expected !== player.id) return jsonError(event, 409, "account_mismatch");
      const records = await readOfficeEscapeRecords(db, player.id, Date.now());
      return noStore(event, player.kind === "guest" ? { ...records, guest: guestInfo(player) } : records);
    },
    { checkOrigin: false },
  ),
);
