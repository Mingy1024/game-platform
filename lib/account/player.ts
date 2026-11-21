import type { Player, PrismaClient } from "@/generated/prisma/client";
import { randomId, randomInt } from "./crypto";
import { randomNick, type Nick } from "./nick/nick";
import { nickNextAt } from "./nick/rules";

export type { Player };

/**
 * 需要登入的 API 在沒登入時丟出（route handler 的 guarded 轉成 401）。
 * 取得目前玩家請用 server/utils/account.ts 的 requireSessionPlayer：它會在 session 續期時一併更新 cookie。
 */
export class UnauthorizedError extends Error {
  status = 401;
}

export function playerNick(player: Player): Nick {
  return { adj: player.nickAdj, noun: player.nickNoun, num: player.nickNum, custom: player.nickCustom };
}

/** GET /api/me 的回應 */
export type MeResponse =
  | { loggedIn: false }
  | { loggedIn: true; playerId: string; nick: Nick; nickNextAt: string | null };

export function meResponse(player: Player | null, now = new Date()): MeResponse {
  if (!player) return { loggedIn: false };
  return {
    loggedIn: true,
    // 站內的隨機 ID（不是 Google 帳號代碼）。前端用它確認重送的紀錄還是送給同一個帳號
    playerId: player.id,
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
