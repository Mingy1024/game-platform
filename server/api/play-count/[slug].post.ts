import { getRouterParam } from "h3";
import { MAX_PLAY_BODY_BYTES, isPlayCountGame, parsePlayBody, recordPlay } from "@/lib/play-count";

/**
 * 回報玩完一局（docs/plans/play-count.md）：POST /api/play-count/<slug>，內容 { runId }。
 * 同一個 runId 只加一次（觸發器在同一個 SQL 動作裡記代碼與加一）。不看登入、不存玩家與 IP。
 * 回應：{ counted }（這次有沒有加；重複的代碼是 false，也算成功）。
 * 錯誤：404 not_found（功能關閉或不是站上的遊戲）、403 origin、429 rate（同一個 IP 每分鐘超過 10 次）、
 * 503 unavailable（限流 binding 出錯）、400／411／413 bad_request（runId 格式不對、內容太大或沒有長度）、500 server。
 * 前端任何錯誤都不重送（lib/play-count/client.ts）。
 */
export default defineEventHandler((event) =>
  guarded(
    event,
    async () => {
      const slug = getRouterParam(event, "slug");
      if (!isPlayCountGame(slug)) return jsonError(event, 404, "not_found");
      const rate = await checkRateLimit(event, "PLAYS_LIMITER", clientIp(event));
      if (rate !== "ok") return jsonError(event, rate === "limited" ? 429 : 503, rate === "limited" ? "rate" : "unavailable");
      const read = await readJsonBody(event, MAX_PLAY_BODY_BYTES);
      if (typeof read === "number") return jsonError(event, read, "bad_request");
      const body = parsePlayBody(read.body);
      if (!body) return jsonError(event, 400, "bad_request");
      return noStore(event, { counted: await recordPlay(useD1(event), slug, body.runId, Date.now()) });
    },
    { playCount: true },
  ),
);
