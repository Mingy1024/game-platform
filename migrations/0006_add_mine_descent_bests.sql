-- CreateTable
CREATE TABLE "mine_descent_bests" (
    "player_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "achieved_at" DATETIME NOT NULL,

    PRIMARY KEY ("player_id", "mode"),
    CONSTRAINT "mine_descent_bests_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "mine_descent_bests_mode_score_idx" ON "mine_descent_bests"("mode", "score" DESC);

