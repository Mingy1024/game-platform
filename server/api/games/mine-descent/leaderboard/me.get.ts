import { getQuery } from "h3";
import { isScope } from "@/lib/games/mine-descent/leaderboard";

/**
 * 自己的名次（T5、T6、T23）：?scope=score|depth&player=<前端以為的身分>
 * 回應 { rank, score, total, toTop100 }；這張榜沒有成績時 rank、score 是 null。每次現算、不快取。
 * 身分是 Google 登入或訪客；都沒有回 401。player 和目前的身分不同回 409 account_mismatch。
 */
export default defineEventHandler((event) =>
  guarded(
    event,
    async () => {
      const { scope, player } = getQuery(event);
      if (!isScope(scope)) return jsonError(event, 400, "bad_request");
      // 唯讀的身分查詢：GET 不續期、不動 cookie（docs/plans/sync-hardening.md #4）
      const identity = await readIdentity(event, useDb(event), true);
      if (identity.kind === "none") return jsonError(event, 401, "unauthorized");
      if (typeof player === "string" && player !== identity.player.id) return jsonError(event, 409, "account_mismatch");
      return noStore(event, await readMineMine(useD1(event), scope, identity.player.id, Date.now()));
    },
    { checkOrigin: false, leaderboard: true },
  ),
);
