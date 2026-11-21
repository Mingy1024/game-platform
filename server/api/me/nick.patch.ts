import { getRequestHeader, readBody, type H3Event } from "h3";
import { Prisma } from "@/generated/prisma/client";
import { meResponse, requirePlayer, type Player } from "@/lib/account/player";
import { checkNickFormat, cleanNick, nickKey, nickNextAt } from "@/lib/account/nick/rules";

/** 請求內容的上限：暱稱最多 12 個字，正常的 JSON 遠小於這個大小 */
const MAX_BODY_BYTES = 1024;

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
 * 錯誤時回 400／409／413／429／503，body 是
 * { error: "bad_request" | "length" | "chars" | "blocked" | "taken" | "too_soon" | "rate" | "unavailable" }
 */
export default defineEventHandler((event) =>
  guarded(event, async () => {
    const db = useDb(event);
    const player = await requirePlayer(db, sessionToken(event));

    // 先限流再讀內容：無效的請求也算次數
    const rate = await checkRateLimit(event, player.id);
    if (rate === "limited") return jsonError(event, 429, "rate");
    if (rate === "unavailable") return jsonError(event, 503, "unavailable");

    const length = Number(getRequestHeader(event, "content-length") ?? 0);
    if (length > MAX_BODY_BYTES) return jsonError(event, 413, "bad_request");
    const body = (await readBody<unknown>(event).catch(() => null)) as { custom?: unknown } | null;
    if (!body || typeof body !== "object" || !("custom" in body) || (body.custom !== null && typeof body.custom !== "string")) {
      return jsonError(event, 400, "bad_request");
    }

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

/** 改名途中被同一個人的其他請求搶先改過：回 409，有冷卻時附上下次可以改的時間 */
async function conflict(event: H3Event, db: ReturnType<typeof useDb>, playerId: Player["id"], now: Date) {
  const latest = await db.player.findUnique({ where: { id: playerId } });
  const next = latest ? nickNextAt(latest.nickChangedAt, now) : null;
  return jsonError(event, 409, "too_soon", next ? { nickNextAt: next.toISOString() } : undefined);
}
