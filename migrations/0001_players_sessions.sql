-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "google_sub" TEXT,
    "nick_adj" INTEGER NOT NULL,
    "nick_noun" INTEGER NOT NULL,
    "nick_num" INTEGER NOT NULL,
    "nick_custom" TEXT,
    "nick_key" TEXT,
    "nick_changed_at" DATETIME,
    "created_at" DATETIME NOT NULL,
    "last_seen_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "player_id" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL,
    CONSTRAINT "sessions_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "players_google_sub_key" ON "players"("google_sub");

-- CreateIndex
CREATE UNIQUE INDEX "players_nick_key_key" ON "players"("nick_key");

-- CreateIndex
CREATE INDEX "sessions_player_id_idx" ON "sessions"("player_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");
