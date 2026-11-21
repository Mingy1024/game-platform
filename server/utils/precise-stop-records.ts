import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { UnauthorizedError } from "@/lib/account/player";
import { CLOCK_SKEW_MS, dailyWindow, dedupeBests, type AccountRecords, type SyncBody } from "@/lib/games/precise-stop/account-records";
import { taiwanDateKey } from "@/lib/games/precise-stop/route";

/**
 * 精準停車的帳號紀錄（帳號設計稿第 11 節）：讀取、合併本機送來的紀錄。
 * D1 沒有交易，每一步都寫成可以重複執行、彼此搶先也不會出錯的條件更新。
 */

/** 帳號紀錄：最近 14 天的今日挑戰、自由模式最佳、累計完美停車次數 */
export async function readAccountRecords(db: PrismaClient, playerId: string, now: number): Promise<AccountRecords> {
  // 上限和同步檢查一樣容許手機時鐘快 1 天：收下的紀錄一定讀得回來
  const { from } = dailyWindow(now);
  const to = taiwanDateKey(now + CLOCK_SKEW_MS);
  const [rows, stats] = await Promise.all([
    db.preciseStopBest.findMany({
      where: { playerId, OR: [{ mode: "free" }, { mode: "daily", dateKey: { gte: from, lte: to } }] },
    }),
    db.preciseStopStats.findUnique({ where: { playerId } }),
  ]);
  const daily: Record<string, number> = {};
  let free: number | null = null;
  for (const row of rows) {
    if (row.mode === "free") free = row.score;
    else daily[row.dateKey] = row.score;
  }
  return { daily, free, perfectStops: stats?.perfectStops ?? 0 };
}

const isCode = (error: unknown, code: string) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

/** 寫入時玩家剛被刪除（外鍵不存在）：當作未登入 */
function rethrow(error: unknown): never {
  if (isCode(error, "P2003")) throw new UnauthorizedError("帳號已刪除");
  throw error;
}

/** 一筆最佳紀錄最多重試幾次（和別的請求同時寫同一筆時） */
const MAX_ATTEMPTS = 3;

/** 只換掉比較低的分數；有換到回傳 true */
async function raiseBest(
  db: PrismaClient,
  key: { playerId: string; mode: string; dateKey: string },
  data: { score: number; achievedAt: Date },
): Promise<boolean> {
  const { count } = await db.preciseStopBest.updateMany({ where: { ...key, score: { lt: data.score } }, data });
  return count > 0;
}

/**
 * 合併一批本機紀錄（第 15 題）：每筆取高分，較低的分數不覆蓋、創下時間也不變；
 * 完美次數加上 perfectDelta，但同一個 syncId 只加一次（重送不重複加，P4）。
 */
export async function applySync(db: PrismaClient, playerId: string, body: SyncBody, now: number): Promise<void> {
  for (const entry of dedupeBests(body.bests)) {
    const key = { playerId, mode: entry.mode, dateKey: entry.dateKey ?? "" };
    // 手機時鐘可能比伺服器快一點（parseSyncBody 容許 1 天）：創下時間不晚於現在
    const data = { score: entry.score, achievedAt: new Date(Math.min(entry.achievedAt, now)) };
    // 先試著只更新比較低的分數；沒有這一筆才建立。
    // 和別的請求同時寫：建立撞到（P2002）、或查到的是對方剛寫進的較低分數，都再試一次條件更新
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (await raiseBest(db, key, data)) break;
      const exists = await db.preciseStopBest.findUnique({ where: { playerId_mode_dateKey: key }, select: { score: true } });
      if (exists && exists.score >= entry.score) break;
      if (exists) continue;
      try {
        await db.preciseStopBest.create({ data: { ...key, ...data } });
        break;
      } catch (error) {
        if (!isCode(error, "P2002")) rethrow(error);
      }
    }
  }

  if (body.perfectDelta === 0) return;
  // 記下這一批：資料庫觸發器在同一個動作裡把次數加進累計（schema.prisma 的 PreciseStopSyncBatch）。
  // 已經記過（P2002）就是重送，次數一定已經加過，不再加
  try {
    await db.preciseStopSyncBatch.create({
      data: { playerId, syncId: body.syncId, perfectDelta: body.perfectDelta, createdAt: new Date(now) },
    });
  } catch (error) {
    if (isCode(error, "P2002")) return;
    rethrow(error);
  }
}
