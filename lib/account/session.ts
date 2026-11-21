import type { PrismaClient } from "@/generated/prisma/client";
import { randomToken, sha256Hex } from "./crypto";

export const SESSION_COOKIE = "gs_session";
const DAY = 24 * 60 * 60 * 1000;
/** session 有效 400 天（瀏覽器 cookie 的上限也是 400 天） */
export const SESSION_TTL_MS = 400 * DAY;
/** 剩不到 200 天時，使用就延長回 400 天 */
const RENEW_BELOW_MS = 200 * DAY;
/** 最後使用時間一天最多更新一次，避免每個請求都寫資料庫 */
const SEEN_EVERY_MS = DAY;

/** 新的到期時間；不用延長時回傳 null */
export function renewedExpiry(expiresAt: Date, now: Date): Date | null {
  return expiresAt.getTime() - now.getTime() < RENEW_BELOW_MS ? new Date(now.getTime() + SESSION_TTL_MS) : null;
}

export async function createSession(db: PrismaClient, playerId: string, now = new Date()) {
  const token = randomToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.session.create({
    data: { id: await sha256Hex(token), playerId, expiresAt, createdAt: now },
  });
  return { token, expiresAt };
}

/**
 * 用 cookie 的 token 找出玩家。過期的 session 會刪掉；快到期的會延長，
 * 延長時回傳新的 expiresAt，呼叫的地方要順便更新 cookie。
 */
export async function validateSession(db: PrismaClient, token: string, now = new Date()) {
  if (!token || token.length > 100) return null;
  const id = await sha256Hex(token);
  const session = await db.session.findUnique({ where: { id }, include: { player: true } });
  if (!session) return null;
  if (session.expiresAt <= now) {
    await db.session.delete({ where: { id } }).catch(() => {});
    return null;
  }

  const renewed = renewedExpiry(session.expiresAt, now);
  const writes: Promise<unknown>[] = [];
  if (renewed) writes.push(db.session.update({ where: { id }, data: { expiresAt: renewed } }));
  if (now.getTime() - session.player.lastSeenAt.getTime() > SEEN_EVERY_MS) {
    writes.push(db.player.update({ where: { id: session.playerId }, data: { lastSeenAt: now } }));
  }
  await Promise.all(writes);

  return { player: session.player, sessionId: id, renewedExpiresAt: renewed };
}

export async function deleteSession(db: PrismaClient, token: string) {
  if (!token) return;
  await db.session.deleteMany({ where: { id: await sha256Hex(token) } });
}

/** 每日排程：清掉過期的 session */
export async function deleteExpiredSessions(db: PrismaClient, now = new Date()) {
  const { count } = await db.session.deleteMany({ where: { expiresAt: { lte: now } } });
  return count;
}
