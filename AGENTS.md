# AGENTS.md

遊戲小站（game-platform）：Nuxt 4 + Vue 3 + TypeScript、Tailwind 4、Phaser 4，部署在 Cloudflare Workers，資料庫 Cloudflare D1 + Prisma 7。**不是 Next.js**（已於 2026-11-21 移植到 Nuxt）。

專案規則、指令與文件索引都在 [CLAUDE.md](./CLAUDE.md)，請先讀它，重點如下：

- 回覆、註解、commit、文件一律用繁體中文（台灣用語）；commit 直接做在 `main`，格式 `type: 描述`。
- 改 `prisma/schema.prisma` 要產生新 migration，不改已存在的 migration、不手改 `generated/`。
- 會改資料的 API 包 `guarded()`；GET 不能有寫入副作用；共用狀態／API／登入類改動先照 `docs/dev/sync-checklist.md`。
- 不讀、不改 `.env`、`.dev.vars`；不部署、不對正式 D1 執行 migration，除非使用者明確要求。
- 驗證：`npm test`、`npm run typecheck`、`npm run lint`；動到畫面、登入或同步再跑 `npm run test:e2e`。
- 架構見 `docs/ARCHITECTURE.md`，開發規範見 `docs/DEVELOPMENT.md`。
