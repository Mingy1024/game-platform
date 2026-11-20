// Prisma CLI 設定。網站執行時用 D1（lib/db.ts），不會讀這裡的 datasource；
// 這個 SQLite 檔只給 prisma migrate diff 等指令用。
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: "file:./.wrangler/prisma-cli.db",
  },
});
