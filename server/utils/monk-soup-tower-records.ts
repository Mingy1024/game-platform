import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { UnauthorizedError } from "@/lib/account/player";
import { dedupeBests, type AccountRecords, type SyncBody } from "@/lib/games/monk-soup-tower/account-records";

/**
 * 和尚端湯上塔的帳號紀錄：讀取、合併本機送來的紀錄（P2、P4）。
 * 只取最佳（分數高、同分時間短、再同先創下的），沒有累計次數，所以整批重送結果不變。
 * D1 沒有交易，每一步都寫成可以重複執行、彼此搶先也不會出錯的條件更新。
 */

/** 帳號紀錄：兩種模式各自的最佳分數與時間 */
export async function readMonkSoupTowerRecords(db: PrismaClient, playerId: string): Promise<AccountRecords> {
  const rows = await db.monkSoupTowerBest.findMany({ where: { playerId } });
  const records: AccountRecords = { fixed: null, random: null };
  for (const row of rows) {
    if (row.mode === "fixed" || row.mode === "random") records[row.mode] = { score: row.score, timeMs: row.timeMs };
  }
  return records;
}

const isCode = (error: unknown, code: string) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

/** 寫入時玩家剛被刪除（外鍵不存在）：當作未登入 */
function rethrow(error: unknown): never {
  if (isCode(error, "P2003")) throw new UnauthorizedError("帳號已刪除");
  throw error;
}

const MAX_ATTEMPTS = 3;

/** 合併一批本機紀錄：每種模式取最佳，較差的不覆蓋、創下時間也不變（P4） */
export async function applyMonkSoupTowerSync(db: PrismaClient, playerId: string, body: SyncBody, now: number): Promise<void> {
  for (const entry of dedupeBests(body.bests)) {
    const key = { playerId, mode: entry.mode };
    // 手機時鐘可能比伺服器快一點（parseSyncBody 容許 1 天）：創下時間不晚於現在
    const data = { score: entry.score, timeMs: entry.timeMs, achievedAt: new Date(Math.min(entry.achievedAt, now)) };
    // 「比較差」的定義：分數比較低；或同分但時間比較長；或同分同時間但比較晚創下（T2，Codex 審查第 1 輪）
    const worse = {
      OR: [
        { score: { lt: entry.score } },
        { score: entry.score, timeMs: { gt: entry.timeMs } },
        { score: entry.score, timeMs: entry.timeMs, achievedAt: { gt: data.achievedAt } },
      ],
    };
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const { count } = await db.monkSoupTowerBest.updateMany({ where: { ...key, ...worse }, data });
      if (count > 0) break;
      const exists = await db.monkSoupTowerBest.findUnique({ where: { playerId_mode: key }, select: { score: true, timeMs: true, achievedAt: true } });
      const notWorse =
        exists &&
        (exists.score > entry.score ||
          (exists.score === entry.score && (exists.timeMs < entry.timeMs || (exists.timeMs === entry.timeMs && exists.achievedAt <= data.achievedAt))));
      if (notWorse) break;
      if (exists) continue;
      try {
        await db.monkSoupTowerBest.create({ data: { ...key, ...data } });
        break;
      } catch (error) {
        if (!isCode(error, "P2002")) rethrow(error);
      }
    }
  }
}
