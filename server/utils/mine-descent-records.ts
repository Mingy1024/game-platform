import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { UnauthorizedError } from "@/lib/account/player";
import { dedupeBests, type AccountRecords, type SyncBody } from "@/lib/games/mine-descent/account-records";

/**
 * 礦坑大逃亡的帳號紀錄：讀取、合併本機送來的紀錄（P2、P3）。
 * 只取高值、沒有累計次數，所以整批重送結果不變。D1 沒有交易，每一步都寫成可以重複執行、
 * 彼此搶先也不會出錯的條件更新。
 */

/** 帳號紀錄：最高分與最深的深度 */
export async function readMineDescentRecords(db: PrismaClient, playerId: string): Promise<AccountRecords> {
  const rows = await db.mineDescentBest.findMany({ where: { playerId } });
  const records: AccountRecords = { score: null, depth: null };
  for (const row of rows) {
    if (row.mode === "score") records.score = row.score;
    else if (row.mode === "depth") records.depth = row.score;
  }
  return records;
}

const isCode = (error: unknown, code: string) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

/** 寫入時玩家剛被刪除（外鍵不存在）：當作未登入 */
function rethrow(error: unknown): never {
  if (isCode(error, "P2003")) throw new UnauthorizedError("帳號已刪除");
  throw error;
}

/** 一筆最佳紀錄最多重試幾次（和別的請求同時寫同一筆時） */
const MAX_ATTEMPTS = 3;

/** 合併一批本機紀錄：每筆取高值，較低的值不覆蓋、創下時間也不變（P3） */
export async function applyMineDescentSync(db: PrismaClient, playerId: string, body: SyncBody, now: number): Promise<void> {
  for (const entry of dedupeBests(body.bests)) {
    const key = { playerId, mode: entry.mode };
    // 手機時鐘可能比伺服器快一點（parseSyncBody 容許 1 天）：創下時間不晚於現在
    const data = { score: entry.score, achievedAt: new Date(Math.min(entry.achievedAt, now)) };
    // 先試著只更新比較低的值；沒有這一筆才建立。
    // 和別的請求同時寫：建立撞到（P2002）、或查到的是對方剛寫進的較低值，都再試一次條件更新
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const { count } = await db.mineDescentBest.updateMany({ where: { ...key, score: { lt: data.score } }, data });
      if (count > 0) break;
      const exists = await db.mineDescentBest.findUnique({ where: { playerId_mode: key }, select: { score: true } });
      if (exists && exists.score >= entry.score) break;
      if (exists) continue;
      try {
        await db.mineDescentBest.create({ data: { ...key, ...data } });
        break;
      } catch (error) {
        if (!isCode(error, "P2002")) rethrow(error);
      }
    }
  }
}
