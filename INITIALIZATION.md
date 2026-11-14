# 初始化紀錄

日期：2026-11-08。依據先前的《網頁小遊戲平台專案規劃》初始化工具，未開始產品開發。

## 已完成

- 官方 create-next-app 16.4.5 預設 App Router 範本：TypeScript、React、Tailwind CSS、ESLint，沒有 src 目錄，別名 `@/*`。
- 保留 `app/page.tsx`、`app/layout.tsx`、`app/globals.css`、`public/` 的預設內容。
- 安裝 Phaser、Zod。
- 安裝 Prisma 7.10.1、Prisma Client、PostgreSQL adapter、pg、dotenv；官方初始化的 `prisma/schema.prisma` 與 `prisma7.config.ts`，schema 無任何 model。
- 安裝 Vitest，提供 `vitest.config.mts`；安裝 Playwright，提供三瀏覽器設定。沒有新增測試案例。
- 提供 `.env.example`，本機 `.env` 僅複製範例值且被 Git 忽略。這些值不是已建立的資料庫或外部服務。
- Git 初始化，分支 main；尚未 commit、設定 remote 或推送。
- npm lockfile 已產生。使用 Node.js 24.22.1、npm 12.2.2；Node 型別使用 24 系列。

## 啟動

在本專案資料夾執行（需要 Node.js 24 與 npm）：

```powershell
npm ci
npm run dev
```

開啟 http://localhost:3000，看到官方 Next.js 預設頁面即為預期結果。本機已有 node_modules 時可直接執行 `npm run dev`。

這次執行環境沒有全域 npm，使用工作區 `C:/Users/user/Documents/Codex/2026-11-07/https-games-casper-tw-https-games/work/npm-tool/package/bin/npm-cli.js` 的 npm 12.2.2 完成安裝。若仍在相同環境，可用：

```powershell
node C:/Users/user/Documents/Codex/2026-11-07/https-games-casper-tw-https-games/work/npm-tool/package/bin/npm-cli.js run dev
```

一般 Node.js 安裝附帶 npm，其他電腦不需要這個暫存工具路徑。未改動系統 PATH 或系統 Node 安裝。

## 工具指令

```powershell
npm run typecheck
npm run lint
npm run build
npm test
npm run test:watch
npm run test:e2e
npm run db:validate
```

`npm test` 與 `npm run test:e2e` 目前沒有案例；驗證初始化時分別使用 `--passWithNoTests` 與 `--list --pass-with-no-tests` 確認工具設定可讀，不代表已有業務測試或瀏覽器 E2E 測試通過。

Playwright 瀏覽器位於本機工具快取，不提交 Git。換電腦後執行：

```powershell
npx playwright install chromium firefox webkit
```

## 資料庫狀態

已初始化 PostgreSQL 的 Prisma 工具設定，但未安裝系統 PostgreSQL 服務、建立資料庫、啟動資料庫、連線或執行 migration。開發網站預設頁面不需要資料庫。

後續可設定真實 `DATABASE_URL`；Prisma 也提供 `npm run db:dev` 啟動本機開發資料庫，這次未執行。設定檔使用官方初始化的名稱 `prisma7.config.ts`，CLI 可自動讀取。

`db:generate`、`db:migrate`、`db:studio` 指令已準備，待定義資料模型及資料庫配置後再使用。沒有假資料、seed、認證、API 或廣告接入；`ADS_MODE` 等範例環境值尚無產品程式讀取。

## 檢查結果與備註

- `typecheck`、`lint`、`build` 通過，建置僅包含預設 `/` 及框架的 not-found。
- Prisma 空 schema 驗證通過。
- Vitest 與 Playwright 設定載入正常，案例數均為 0。
- 安裝時 npm audit 顯示 8 個 moderate 問題，來自 ESLint／typescript-eslint 的 minimatch 開發依賴鏈；未使用 `audit fix --force` 降級 Next.js 工具鏈。後續開發前應重新檢查並隨官方相容修補更新。
- npm 12 預設阻擋 Prisma／engines 的部分安裝 scripts；CLI 初始化與 validate 已正常執行，尚未驗證資料庫引擎的實際連線。後續若需安裝 scripts，可先用 `npm install-scripts ls` 檢視官方套件再依 npm 的 allowScripts 機制核准。
- Prisma 初始化嘗試安裝的選用 AI skills 未成功，不影響 schema 初始化；沒有自行補裝技能。

目前不建立規劃中的自訂 components、games、content、API 或其他產品目錄，保持框架預設架構。後續開發再依原規劃分階段擴充。
