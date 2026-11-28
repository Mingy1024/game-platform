-- CreateTable
CREATE TABLE "monk_soup_tower_bests" (
    "player_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "time_ms" INTEGER NOT NULL,
    "achieved_at" DATETIME NOT NULL,

    PRIMARY KEY ("player_id", "mode"),
    CONSTRAINT "monk_soup_tower_bests_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "monk_soup_tower_bests_mode_score_time_ms_idx" ON "monk_soup_tower_bests"("mode", "score" DESC, "time_ms");

