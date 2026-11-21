import { getRequestHeader, readRawBody, type H3Event } from "h3";
import { Prisma } from "@/generated/prisma/client";
import { meResponse, UnauthorizedError, type Player } from "@/lib/account/player";
import { checkNickFormat, cleanNick, nickKey, nickNextAt } from "@/lib/account/nick/rules";

/**
 * 請求內容的上限：暱稱最多 12 個字，正常的 JSON 遠小於這個大小。
 * 瀏覽器送 JSON 一定帶 Content-Length；沒有或超過就拒絕，讀進來後再用實際長度檢查一次。
 * （Nitro 在呼叫 handler 前已經讀完請求內容，整體大小由 Cloudflare 平台的請求上限保護；
 * 這裡確保超過上限的內容不會被解析、也不會寫進資料庫。）
 */
const MAX_BODY_BYTES = 1024;

/** 讀取並解析請求內容；格式不對或太大時回傳錯誤狀態碼 */
async function readNickBody(event: H3Event): Promise<{ custom: string | null } | 400 | 411 | 413> {
  const header = getRequestHeader(event, "content-length");
  if (header === undefined) return 411;
  const declared = Number(header);
  if (!Number.isFinite(declared) || declared < 0) return 400;
  if (declared > MAX_BODY_BYTES) return 413;
  const raw = await readRawBody(event, false).catch(() => undefined);
  if (raw && raw.byteLength > MAX_BODY_BYTES) return 413;
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(raw ?? new Uint8Array()));
  } catch {
    return 400;
  }
  if (!body || typeof body !== "object" || !("custom" in body)) return 400;
  const { custom } = body as { custom: unknown };
  if (custom !== null && typeof custom !== "string") return 400;
  return { custom };
}

/**
 * 同一個人 1 分鐘內最多 5 次（wrangler.jsonc 的 NICK_LIMITER）。
 * Cloudflare 的限流是各資料中心分開計數，不是全域精確的上限，用來擋連續送出已經足夠。
 *
 * - "ok"：可以繼續
 * - "limited"：超過次數
 * - "unavailable"：正式環境沒有 binding 或 binding 出錯（記錄下來、拒絕請求，不默默放行）
 * 本機開發沒有 binding 時不限制。
 */
async function checkRateLimit(event: H3Event, playerId: string): Promise<"ok" | "limited" | "unavailable"> {
  const limiter = cloudflareEnv(event).NICK_LIMITER;
  if (!limiter) {
    if (import.meta.dev) return "ok";
    console.error("NICK_LIMITER binding 不存在：請確認 wrangler.jsonc 的 ratelimits");
    return "unavailable";
  }
  try {
    return (await limiter.limit({ key: playerId })).success ? "ok" : "limited";
  } catch (error) {
    console.error("NICK_LIMITER 呼叫失敗", error);
    return "unavailable";
  }
}

/**
 * 改暱稱或改回隨機名字。
 *   { "custom": "阿明號" }  自訂暱稱（7 天一次）
 *   { "custom": null }      改回隨機名字（不受冷卻限制）
 * 錯誤時回 400／401／409／411／413／429／503，body 是
 * { error: "bad_request" | "unauthorized" | "length" | "chars" | "blocked" | "taken" | "too_soon" | "conflict" | "rate" | "unavailable" }
 */
export default defineEventHandler((event) =>
  guarded(event, async () => {
    const db = useDb(event);
    const player = await requireSessionPlayer(event, db);

    // 先限流再讀內容：無效的請求也算次數
    const rate = await checkRateLimit(event, player.id);
    if (rate === "limited") return jsonError(event, 429, "rate");
    if (rate === "unavailable") return jsonError(event, 503, "unavailable");

    const body = await readNickBody(event);
    if (typeof body === "number") return jsonError(event, body, "bad_request");

    const now = new Date();
    const respond = async () => {
      const latest = await db.player.findUniqueOrThrow({ where: { id: player.id } });
      return noStore(event, meResponse(latest, now));
    };

    if (body.custom === null) {
      await db.player.update({ where: { id: player.id }, data: { nickCustom: null, nickKey: null } });
      return respond();
    }

    const value = cleanNick(body.custom);
    const formatError = checkNickFormat(value);
    if (formatError) return jsonError(event, 400, formatError);

    const key = nickKey(value);
    // 只改大小寫、空白之類的同一個名字，不用重新冷卻也不算重複
    if (key === player.nickKey) {
      // 條件裡帶著 nickKey：讀完之後如果別的請求已經換了名字，就不要只改顯示名稱，否則兩者會對不上
      const { count } = await db.player.updateMany({ where: { id: player.id, nickKey: key }, data: { nickCustom: value } });
      if (count === 0) return conflict(event, db, player.id, now);
      return respond();
    }

    const next = nickNextAt(player.nickChangedAt, now);
    if (next) return jsonError(event, 409, "too_soon", { nickNextAt: next.toISOString() });

    try {
      // 條件裡帶著讀到的 nickKey、nickChangedAt：兩個分頁同時改名時只有一個會成功，另一個不能繞過 7 天冷卻
      const { count } = await db.player.updateMany({
        where: { id: player.id, nickKey: player.nickKey, nickChangedAt: player.nickChangedAt },
        data: { nickCustom: value, nickKey: key, nickChangedAt: now },
      });
      if (count === 0) return conflict(event, db, player.id, now);
      return respond();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return jsonError(event, 409, "taken");
      }
      throw error;
    }
  }),
);

/**
 * 改名途中被同一個人的其他請求搶先改過（條件更新沒有更新到任何一筆）：
 * - 帳號已經被刪除：401
 * - 對方剛改過名字、進入冷卻：409 too_soon，附上下次可以改的時間
 * - 其他（例如對方改回隨機名字）：409 conflict，前端重新讀取帳號狀態
 */
async function conflict(event: H3Event, db: ReturnType<typeof useDb>, playerId: Player["id"], now: Date) {
  const latest = await db.player.findUnique({ where: { id: playerId } });
  if (!latest) throw new UnauthorizedError("帳號已刪除");
  const next = nickNextAt(latest.nickChangedAt, now);
  if (next) return jsonError(event, 409, "too_soon", { nickNextAt: next.toISOString() });
  return jsonError(event, 409, "conflict");
}
