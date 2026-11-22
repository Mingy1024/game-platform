# CLAUDE.md

## 專案概述

遊戲小站（game-platform）— 免下載、免登入的原創網頁小遊戲站，目前上線「精準停車」，支援七種語言。
Nuxt 4（Vue 3、TypeScript）+ Tailwind 4 + Phaser 4，部署在 Cloudflare Workers（Nitro `cloudflare_module`），資料庫 Cloudflare D1 + Prisma 7。

> 根目錄的 `AGENTS.md` 是給其他 AI 工具（例如 Codex）看的精簡版，內容與本檔一致；本專案已經移植到 Nuxt，不是 Next.js。

## 常用指令

| 指令 | 用途 |
| --- | --- |
| `npm run dev` | 本機開發 http://localhost:3000（D1 由 wrangler 在本機模擬，資料在 `.wrangler/state`） |
| `npm run db:migrate:local` | 把 `migrations/` 套用到本機 D1（第一次開發前、有新 migration 時跑） |
| `npm test` | Vitest 單元測試 |
| `npm run test:e2e` | Playwright E2E（自動啟動 dev server 與假的 Google 登入） |
| `npm run typecheck` / `npm run lint` | 型別檢查 / ESLint |
| `npm run build` / `npm run preview` | 正式建置 / 用 workerd 在 http://localhost:8787 預覽 |
| `npm run db:migration -- <名稱>` | 改了 `prisma/schema.prisma` 後產生 migration |
| `npm run db:generate` | 重新產生 Prisma Client |
| `npm run cf:deploy`、`npm run db:migrate:remote` | **正式環境**，使用者沒要求就不要跑 |

## 關鍵規則

- 程式註解、commit、文件、回覆一律用繁體中文（台灣用語）。
- commit 直接做在 `main`，不開分支；格式 `type: 描述`（feat／fix／docs／chore）。
- 資料庫是 D1（SQLite）：改 schema 一定要產生 migration，不手改 `migrations/` 已存在的檔案、不手改 `generated/`。
- 會改資料的 API 一律包 `guarded()`（檢查 Origin、轉 401／500、功能旗標）；GET 不能有寫入副作用。
- 共用狀態／API／登入類改動，**先照 `docs/dev/sync-checklist.md` 把表填完再寫程式**。
- 功能開關（`FEATURE_*`）、`SITE_URL`、`ADS_MODE` 是建置時寫死的，改了要重新建置。
- 功能開發使用 `docs/plans/` 記錄計畫；完成後移至 `docs/plans/archive/`。

## 詳細文件

- ./README.md — 項目介紹、完整指令表、環境變數、Cloudflare 設定
- ./docs/ARCHITECTURE.md — 架構、目錄結構、API 總覽、資料庫 schema
- ./docs/DEVELOPMENT.md — 開發規範、命名、新增 API／migration 步驟、計畫歸檔流程
- ./docs/FEATURES.md — 功能清單與行為描述
- ./docs/TESTING.md — 測試規範與指南
- ./docs/CHANGELOG.md — 更新日誌
- ./docs/dev/sync-checklist.md — 同步與共用狀態改動標準
- ./docs/acceptance/precise-stop.md — 精準停車驗收標準
- ./docs/sound/precise-stop-prompts.md — 精準停車音效提示詞

## 必要遵守項目

- 不讀取、不輸出、不編輯 `.env`、`.dev.vars` 的內容（含 Google OAuth 密鑰）；變數名稱看 `.env.example`。
- 不部署、不對正式 D1 執行 migration，除非使用者明確要求。
- 對外 API 與紀錄只用 `players.id`（隨機 21 字元），不存 Google 名字、信箱、大頭貼；DB 初期只存基本功能需要的資料，各遊戲不做稱號。
- 純邏輯放 `lib/`（與框架無關、可單元測試），不要把遊戲規則寫在 `.vue` 或 `server/` 裡。
- 新增使用者可見文字時，七種語言字典（`lib/i18n/dictionaries/`）要同步補，`lib/i18n/__tests__/dictionaries.test.ts` 會檢查。
- 視覺設計類工作先套 `frontend-design` 與 `ui-ux-pro-max` skill；做新遊戲走 `new-mini-game` skill。
