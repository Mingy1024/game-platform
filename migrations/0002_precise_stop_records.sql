-- CreateTable
CREATE TABLE "precise_stop_bests" (
    "player_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "date_key" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "achieved_at" DATETIME NOT NULL,

    PRIMARY KEY ("player_id", "mode", "date_key"),
    CONSTRAINT "precise_stop_bests_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "precise_stop_stats" (
    "player_id" TEXT NOT NULL PRIMARY KEY,
    "perfect_stops" INTEGER NOT NULL DEFAULT 0,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "precise_stop_stats_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "precise_stop_sync_batches" (
    "player_id" TEXT NOT NULL,
    "sync_id" TEXT NOT NULL,
    "perfect_delta" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL,

    PRIMARY KEY ("player_id", "sync_id"),
    CONSTRAINT "precise_stop_sync_batches_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "precise_stop_bests_mode_date_key_score_idx" ON "precise_stop_bests"("mode", "date_key", "score" DESC);

-- CreateTrigger（手寫，prisma/schema.prisma 的 PreciseStopSyncBatch 註解）
-- 記下同步批次的同一個 SQL 動作裡，把這一批的完美次數加進累計：兩件事一起成功或一起失敗。
CREATE TRIGGER "precise_stop_sync_batches_apply" AFTER INSERT ON "precise_stop_sync_batches"
BEGIN
    INSERT INTO "precise_stop_stats" ("player_id", "perfect_stops", "updated_at")
    VALUES (NEW."player_id", NEW."perfect_delta", NEW."created_at")
    ON CONFLICT ("player_id") DO UPDATE SET
        "perfect_stops" = "perfect_stops" + excluded."perfect_stops",
        "updated_at" = excluded."updated_at";
END;
