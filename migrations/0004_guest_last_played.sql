-- DropIndex
DROP INDEX "players_kind_last_seen_at_idx";

-- AlterTable
ALTER TABLE "players" ADD COLUMN "last_played_at" DATETIME;

-- CreateIndex
CREATE INDEX "players_kind_last_played_at_idx" ON "players"("kind", "last_played_at");

