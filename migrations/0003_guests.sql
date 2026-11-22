-- AlterTable
ALTER TABLE "players" ADD COLUMN "guest_sync_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "players_guest_sync_id_key" ON "players"("guest_sync_id");

-- CreateIndex
CREATE INDEX "players_kind_last_seen_at_idx" ON "players"("kind", "last_seen_at");

