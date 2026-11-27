-- CreateTable
CREATE TABLE "play_counts" (
    "game" TEXT NOT NULL PRIMARY KEY,
    "count" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "play_count_batches" (
    "run_id" TEXT NOT NULL PRIMARY KEY,
    "game" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "play_count_batches_created_at_idx" ON "play_count_batches"("created_at");

-- CreateTrigger（手寫，prisma/schema.prisma 的 PlayCountBatch 註解）
-- 記下這一局代碼的同一個 SQL 動作裡，把該遊戲的遊玩次數加一：兩件事一起成功或一起失敗。
-- 重複的代碼用 INSERT OR IGNORE 寫入時不會新增列，觸發器也不會跑，所以同一局不會多加。
CREATE TRIGGER "play_count_batches_apply" AFTER INSERT ON "play_count_batches"
BEGIN
    INSERT INTO "play_counts" ("game", "count")
    VALUES (NEW."game", 1)
    ON CONFLICT ("game") DO UPDATE SET "count" = "count" + 1;
END;
