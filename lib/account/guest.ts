import type { Player, PrismaClient } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { randomId, randomInt } from "./crypto";
import { randomNick } from "./nick/nick";
import { createSession, validateSession } from "./session";

/**
 * 排行榜的訪客（精準停車設計稿第 14.2 節，T8–T16）。
 *
 * 訪客是 players 表 kind = guest 的一列，配一個隨機暱稱。瀏覽器的 gs_guest cookie 存一組隨機 token，
 * 資料庫只存它的 SHA-256：和 Google 登入共用 sessions 表（同樣 400 天、快到期時使用就延長），
 * 用玩家的 kind 區分，gs_session 只認 google、gs_guest 只認 guest。
 */
export const GUEST_COOKIE = "gs_guest";
/** 90 天沒玩的訪客由每日排程刪掉（lib/account/guest-merge.ts 的 PURGE_GUESTS_SQL） */

/** gs_guest 的 token 對到的訪客；無效（過期、被刪除、不是訪客）時是 null */
export async function validateGuest(db: PrismaClient, token: string, now = new Date()) {
  const result = await validateSession(db, token, now);
  if (!result || result.player.kind !== "guest") return null;
  return result;
}

const isUnique = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

/** 用這個 syncId 建立的訪客（建立的回應掉了、cookie 沒拿到就重送時找回它，T9） */
export async function findGuestBySyncId(db: PrismaClient, syncId: string): Promise<Player | null> {
  return db.player.findUnique({ where: { guestSyncId: syncId } }).then((player) => (player?.kind === "guest" ? player : null));
}

/**
 * 建立訪客並發一組 token。呼叫的地方要先用 findGuestBySyncId 找過、過了 IP 限流。
 * 同一個 syncId 同時送了兩次時，撞到唯一鍵就改用先建好的那一個（各自拿到一組有效的 token）。
 */
export async function createGuest(
  db: PrismaClient,
  syncId: string,
  now = new Date(),
): Promise<{ player: Player; token: string; expiresAt: Date }> {
  const nick = randomNick(randomInt);
  let player: Player;
  try {
    player = await db.player.create({
      data: {
        id: randomId(),
        kind: "guest",
        guestSyncId: syncId,
        nickAdj: nick.adj,
        nickNoun: nick.noun,
        nickNum: nick.num,
        createdAt: now,
        lastSeenAt: now,
      },
    });
  } catch (error) {
    // 同一個 syncId 同時送了兩次（沒有 Web Locks 的瀏覽器）：另一個請求先建好了
    const existing = isUnique(error) ? await findGuestBySyncId(db, syncId) : null;
    if (!existing) throw error;
    player = existing;
  }
  return { player, ...(await createSession(db, player.id, now)) };
}

/** 找回訪客時補發一組 token */
export async function reissueGuest(db: PrismaClient, player: Player, now = new Date()) {
  return { player, ...(await createSession(db, player.id, now)) };
}
