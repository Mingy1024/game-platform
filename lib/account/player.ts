import type { Player, PrismaClient } from "@/generated/prisma/client";
import { randomId, randomInt } from "./crypto";
import { randomNick, type Nick } from "./nick/nick";
import { nickNextAt } from "./nick/rules";
import { validateSession } from "./session";

export type { Player };

/** 用 session cookie 的 token 找目前玩家；沒登入回傳 null */
export async function getCurrentPlayer(db: PrismaClient, token: string | undefined): Promise<Player | null> {
  if (!token) return null;
  const result = await validateSession(db, token);
  return result?.player ?? null;
}

export class UnauthorizedError extends Error {
  status = 401;
}

/** 同上，但沒登入就丟 UnauthorizedError（route handler 用 jsonError 轉成 401）。遊戲寫紀錄的 API 用它。 */
export async function requirePlayer(db: PrismaClient, token: string | undefined): Promise<Player> {
  const player = await getCurrentPlayer(db, token);
  if (!player) throw new UnauthorizedError("需要登入");
  return player;
}

export function playerNick(player: Player): Nick {
  return { adj: player.nickAdj, noun: player.nickNoun, num: player.nickNum, custom: player.nickCustom };
}

/** GET /api/me 的回應 */
export type MeResponse =
  | { loggedIn: false }
  | { loggedIn: true; nick: Nick; nickNextAt: string | null };

export function meResponse(player: Player | null, now = new Date()): MeResponse {
  if (!player) return { loggedIn: false };
  return {
    loggedIn: true,
    nick: playerNick(player),
    nickNextAt: nickNextAt(player.nickChangedAt, now)?.toISOString() ?? null,
  };
}

/** 用 Google 帳號代碼找玩家；第一次登入就建立新玩家並配一個隨機暱稱 */
export async function findOrCreateGooglePlayer(db: PrismaClient, googleSub: string, now = new Date()): Promise<Player> {
  const existing = await db.player.findUnique({ where: { googleSub } });
  if (existing) return existing;
  const nick = randomNick(randomInt);
  try {
    return await db.player.create({
      data: {
        id: randomId(),
        kind: "google",
        googleSub,
        nickAdj: nick.adj,
        nickNoun: nick.noun,
        nickNum: nick.num,
        createdAt: now,
        lastSeenAt: now,
      },
    });
  } catch (error) {
    // 同一個人同時開兩個分頁登入：另一邊先建好了
    const created = await db.player.findUnique({ where: { googleSub } });
    if (created) return created;
    throw error;
  }
}
