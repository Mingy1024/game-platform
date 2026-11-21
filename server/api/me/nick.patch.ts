import { readBody, type H3Event } from "h3";
import { Prisma } from "@/generated/prisma/client";
import { meResponse, requirePlayer } from "@/lib/account/player";
import { checkNickFormat, cleanNick, nickKey, nickNextAt } from "@/lib/account/nick/rules";

/** 同一個人 1 分鐘內最多 5 次（wrangler.jsonc 的 NICK_LIMITER）。沒有這個 binding 時不限制。 */
async function withinRateLimit(event: H3Event, playerId: string): Promise<boolean> {
  try {
    const limiter = cloudflareEnv(event).NICK_LIMITER;
    if (!limiter) return true;
    return (await limiter.limit({ key: playerId })).success;
  } catch {
    return true;
  }
}

/**
 * 改暱稱或改回隨機名字。
 *   { "custom": "阿明號" }  自訂暱稱（7 天一次）
 *   { "custom": null }      改回隨機名字（不受冷卻限制）
 * 錯誤時回 400／409／429，body 是 { error: "length" | "chars" | "blocked" | "taken" | "too_soon" | "rate" }
 */
export default defineEventHandler((event) =>
  guarded(event, async () => {
    const db = useDb(event);
    const player = await requirePlayer(db, sessionToken(event));
    const body = (await readBody<unknown>(event).catch(() => null)) as { custom?: unknown } | null;
    if (!body || typeof body !== "object" || !("custom" in body) || (body.custom !== null && typeof body.custom !== "string")) {
      return jsonError(event, 400, "bad_request");
    }
    if (!(await withinRateLimit(event, player.id))) return jsonError(event, 429, "rate");

    const now = new Date();

    if (body.custom === null) {
      const updated = await db.player.update({ where: { id: player.id }, data: { nickCustom: null, nickKey: null } });
      return noStore(event, meResponse(updated, now));
    }

    const value = cleanNick(body.custom);
    const formatError = checkNickFormat(value);
    if (formatError) return jsonError(event, 400, formatError);

    const key = nickKey(value);
    // 只改大小寫、空白之類的同一個名字，不用重新冷卻也不算重複
    if (key === player.nickKey) {
      const updated = await db.player.update({ where: { id: player.id }, data: { nickCustom: value } });
      return noStore(event, meResponse(updated, now));
    }

    const next = nickNextAt(player.nickChangedAt, now);
    if (next) return jsonError(event, 409, "too_soon", { nickNextAt: next.toISOString() });

    try {
      const updated = await db.player.update({
        where: { id: player.id },
        data: { nickCustom: value, nickKey: key, nickChangedAt: now },
      });
      return noStore(event, meResponse(updated, now));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return jsonError(event, 409, "taken");
      }
      throw error;
    }
  }),
);
