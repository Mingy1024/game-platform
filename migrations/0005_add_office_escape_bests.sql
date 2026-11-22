-- CreateTable
CREATE TABLE "office_escape_bests" (
    "player_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "date_key" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "achieved_at" DATETIME NOT NULL,

    PRIMARY KEY ("player_id", "mode", "date_key"),
    CONSTRAINT "office_escape_bests_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "office_escape_bests_mode_date_key_score_idx" ON "office_escape_bests"("mode", "date_key", "score" DESC);

