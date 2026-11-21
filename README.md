# 遊戲小站（game-platform）

免下載、免登入的原創網頁小遊戲站。目前上線一款「精準停車」，支援七種語言。

- 網站：[Nuxt 4](https://nuxt.com)（Vue 3、TypeScript、`<script setup>`），樣式用 Tailwind CSS 4
- 遊戲：[Phaser 4](https://phaser.io)，玩家按下「出發」才下載
- 部署：Cloudflare Workers（Nitro 的 `cloudflare_module` preset），資料庫是 Cloudflare D1，Prisma 7 + D1 adapter
- 測試：Vitest（純邏輯）、Playwright（瀏覽器 E2E）

需要 Node.js 24 與 npm。

## 指令

| 指令 | 用途 |
| --- | --- |
| `npm install` | 安裝套件；會自動產生 Prisma Client 和 Nuxt 的型別（`.nuxt/`） |
| `npm run db:migrate:local` | 把 `migrations/` 套用到本機 D1（第一次開發前要跑，之後有新 migration 再跑） |
| `npm run dev` | 本機開發（http://localhost:3000）；D1、限流等 binding 由 wrangler 在本機模擬，資料在 `.wrangler/state` |
| `npm run typecheck` | 型別檢查（`nuxt typecheck`） |
| `npm run lint` | ESLint |
| `npm test` | 單元測試 |
| `npm run test:e2e` | E2E 測試（自動啟動開發伺服器和假的 Google 登入） |
| `npm run build` | 正式建置，輸出到 `.output/`（Worker 在 `.output/server`、靜態檔與預先產生的頁面在 `.output/public`） |
| `npm run preview` | 建置後用 `wrangler dev` 在本機的 workerd 執行，最接近正式環境（http://localhost:8787，用本機 D1） |
| `npm run cf:deploy` | 建置並部署到 Cloudflare（正式環境，執行前請確認） |
| `npm run db:migration -- <名稱>` | 改了 `prisma/schema.prisma` 之後產生下一個 migration |
| `npm run db:migrate:remote` | 把 migrations 套用到正式 D1（正式環境，執行前請確認） |
| `npm run db:generate` | 重新產生 Prisma Client |
| `npm run cf:typegen` | 改了 `wrangler.jsonc` 之後重新產生 binding 型別（`cloudflare-env.d.ts`） |

## 環境變數

範例見 `.env.example`。`npm run dev` 會讀 `.env`；`npm run preview`（wrangler dev）讀 `.dev.vars`。

建置時決定（寫進程式，預先產生的頁面也依它產生，改了要重新建置）：

- `FEATURE_LOGIN=1`：打開登入功能。正式站先不設（設計稿第 12 題）。舊名稱 `NEXT_PUBLIC_FEATURE_LOGIN` 也認得。
- `FEATURE_LEADERBOARD`、`FEATURE_PLAY_COUNT`：預留版位的開關（同上，舊名稱 `NEXT_PUBLIC_FEATURE_*` 也認得）。
- `SITE_URL`：正式網址，用在 canonical、hreflang、社群預覽的絕對網址。正式建置時一定要設。
- `ADS_MODE`：`mock`（預設，顯示版位示意）或 `off`。

執行時讀取（只在伺服器端）：

- `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`：Google Cloud Console 的 OAuth 用戶端。正式站用 `wrangler secret put` 設定，不要寫進檔案或 `wrangler.jsonc`。
- `GOOGLE_OAUTH_TEST_BASE_URL`：只給 E2E 測試用（假的 Google），正式站絕對不要設。

## Cloudflare 設定（`wrangler.jsonc`）

- `DB`：D1。本機開發和 `npm run preview` 用 `.wrangler/state` 裡的本機資料庫；正式的 `database_id` 在第一次部署前用 `wrangler d1 create` 建立後填入。
- `NICK_LIMITER`：改暱稱的限流（同一個人 1 分鐘 5 次）。
- `ASSETS`：靜態檔案（`.output/public`）。`html_handling: drop-trailing-slash` 讓 `/games/precise-stop` 直接對到預先產生的頁面。
- `triggers.crons`：每天台灣時間凌晨 3 點清掉過期 session（`server/plugins/session-cleanup.ts`）。

## 程式結構

| 位置 | 內容 |
| --- | --- |
| `lib/` | 和框架無關的 TypeScript：遊戲邏輯（物理、計分、流程、成績代碼）、目錄、多語系、帳號規則、SEO 資料、網址規則 |
| `app/` | Nuxt 前端：頁面（`pages/`）、元件（`components/`）、composables、版面 |
| `app/games/precise-stop/` | Phaser 場景與音效（只在瀏覽器端、按出發後才載入） |
| `server/` | Nitro 伺服器：帳號 API、成績圖、404 與語言轉址、每日排程 |
| `prisma/`、`migrations/` | D1 的 schema 與 migration |
| `tests/e2e/` | Playwright 測試與假的 Google 登入 |

頁面的產生方式：

- 預先產生（建置時，從 Cloudflare 靜態資源直接提供）：全部遊戲、分類、熱門榜、關於等資訊頁、各語言首頁與遊戲介紹頁（清單在 `lib/routes.ts`）
- 請求時產生（Worker）：繁中首頁 `/`（要先看語言 cookie）、成績連結 `/games/<slug>/r/<代碼>`、我的紀錄與帳號設定
- 成績圖 `/…/r/<代碼>/card`：satori + resvg（WebAssembly）在 Worker 上產生 PNG

E2E 測試的登入流程連到假的 Google（`tests/e2e/fake-google.mjs`），由 `playwright.config.ts` 自動啟動。
