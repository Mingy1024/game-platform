# 階段 6：實作

## 目錄

1. 架構範本（照精準停車的分層）
2. 實作順序
3. 第二款遊戲要先一般化的地方
4. 開發用的除錯掛勾
5. 執行環境與輔助腳本
6. 上一款踩過的坑

技術棧：Nuxt 4（Vue 3、`<script setup>`、Nitro 的 `cloudflare_module` 部署到 Cloudflare Workers）、TypeScript、Tailwind 4、Phaser 4、Zod 4、Prisma 7＋D1、Vitest、Playwright。站名「遊戲小站」，車站主題，色彩 token 在 `app/assets/css/main.css`。元件放 `app/components/`，用檔名直接使用（不加資料夾前綴，名稱要全站唯一）。

## 1. 架構範本

精準停車的分層，新遊戲照同樣的切法（`<slug>` 換成新遊戲）：

| 層 | 位置 | 內容 |
|---|---|---|
| 數值設定 | `lib/games/<slug>/config.ts` | 所有物理、計分、特效上限集中一處，註解對應驗收清單的組別 |
| 純邏輯 | `lib/games/<slug>/*.ts` | 物理（固定步進）、計分、關卡產生（帶種子亂數）、遊戲流程 session（事件：depart／judged／final／restart…）、鏡頭計算、紀錄、分享代碼。**不得 import Phaser**（驗收 Q2） |
| 單元測試 | `lib/games/<slug>/__tests__/` | describe 名稱用驗收編號開頭（「B1 煞車力」），驗收時直接對照 |
| SEO 資料 | `lib/games/<slug>/meta.ts` | gameMetadata、sharedMetadata、sharedBanner（純資料，`app/composables/seo.ts` 的 `usePageMeta` 放進 `<head>`） |
| 成績圖 | `lib/games/<slug>/share/card.ts`、`server/utils/og-image.ts` | lib 產生 satori 的元素樹（1080×1350），伺服器用 satori＋resvg（WebAssembly，`?module` 匯入）畫成 PNG；字型子集在 `public/share-card/fonts/`（用 `server/utils/static-asset.ts` 讀，Workers 上沒有檔案系統），用 `scripts/fetch-share-fonts.mjs` 產生 |
| 介紹頁 | `app/components/<slug>/` | 頁面、開始區、紀錄卡、Experience（介紹頁與遊戲畫面的切換，按出發才 `import()` 遊戲畫面；共用資料用 provide/inject） |
| 遊戲畫面 | `app/components/<slug>/game/`、`app/games/<slug>/` | GameStage.vue（Teleport 到 body、pushState 接管返回鍵、pointer capture、鍵盤、切分頁自動暫停、全螢幕）、各階段面板一個 .vue、SharePanel.vue；Phaser 場景 scene.ts 與音效 sound.ts 放 `app/games/<slug>/`（不是元件）。逐格更新的 snapshot 用 provide/inject 給需要的子元件，GameStage 本身只取 computed 過的少數值，避免每格整個畫面重新渲染 |
| 文字 | `lib/i18n/dictionaries/*.ts` | 每種語言檔新增一個遊戲 key（精準停車是 `preciseStop`）；zh-TW 是基準，型別會檢查其他語言對齊 |
| 美術 | `public/games/<slug>/<version>/` | WebP；版本號放在路徑裡，換圖時升版本避免快取 |
| 驗收 | `docs/acceptance/<slug>.md`、`tests/e2e/` | |

遊戲框內的尺寸用 `cqw`（`u(px)` 輔助函式，設計寬 420），整個遊戲框等比縮放；電腦依視窗高度放大，左右放本局資訊與操作說明，手機佔滿寬度、下方放精簡資訊。

## 2. 實作順序

1. 數值設定與純邏輯，邊寫邊加單元測試（B、C、D 組先綠）。
2. 遊戲畫面骨架：GameStage＋panels，先用最簡單的 Phaser 場景跑通整個流程。
3. 美術進場：載入 Codex 的圖、分層視差、特效。
4. 介紹頁與整頁切換、返回鍵。
5. 紀錄、結算、分享（成績代碼 → 成績頁 → 成績圖）。
6. 多語系文字（七種語言一起補，不要留到最後）。
7. 用開發掛勾讓自動駕駛跑完整局，確認沒有主控台錯誤，再進入驗證。

## 3. 第二款遊戲要先一般化的地方

平台目前只有精準停車一款，以下地方是寫死的。加第二款時先改成依 slug 分派，否則新遊戲的網址會顯示精準停車：

- `app/components/GamePage.vue`、`SharedGamePage.vue`：直接用精準停車的 meta 和 PreciseStopPage。改成依 slug 對應各遊戲（一張 slug → 元件／meta 的對照表）。頁面 `app/pages/games/[slug]/`、`app/pages/[locale]/games/[slug]/` 和成績圖 `server/routes/**/card.get.ts` 同理。
- `lib/catalog/localize.ts`：`localizeGame` 只處理 `precise-stop`。改成依 slug 取對應的文字 key。
- `lib/catalog/__tests__/catalog.test.ts`：A2 斷言目錄只有一款，要改成新的目錄內容。
- `scripts/fetch-share-fonts.mjs`：只收集 `preciseStop` 的文字；新遊戲的成績圖文字也要加進去，否則成績圖會缺字。
- `lib/routes.ts`：404 判斷（`server/middleware/site-routes.ts`）和預先產生的頁面清單，依 `gameSlugs` 是通用的，但成績連結的代碼格式若不同要確認 `SHARE_CODE` 仍適用。
- `tests/e2e/`：目前的測試以精準停車為對象；新遊戲另開 spec 檔，共用 helpers。

## 4. 開發用的除錯掛勾

GameStage 在開發環境（`import.meta.dev`）把 session 掛到 `window.__<遊戲名>`（精準停車是 `window.__preciseStop = { session, fx }`），正式版不提供。session 支援：

- `autopilot = true`：自動以最佳操作玩，用來跑完整局、截圖、E2E。
- `timeScale = N`：加速時間，測試不用等真實時長。
- `fx`：特效計數（粒子數、同時存在的最大值），驗證 G 組的上限。

新遊戲一開始就做這個掛勾，驗證階段幾乎所有自動化都靠它。

## 5. 執行環境與輔助腳本

專案在 WSL2 上，平常 **node_modules 是 Windows 版**，Node 工具用 Windows 的 Node 26 執行（`scripts/wn`）。在 WSL 裝過套件（Linux 版 node_modules）就要在 WSL 用 Linux 的 node 直接執行各工具的進入點；兩邊不能混用，換邊前先在那一邊重新 `npm install`。

輔助腳本在這個 skill 的 `scripts/`（從專案根目錄執行）：

| 腳本 | 用途 |
|---|---|
| `scripts/wn` | 用 Windows Node 跑任何 JS：`.claude/skills/new-mini-game/scripts/wn node_modules/nuxt/bin/nuxt.mjs typecheck` |
| `scripts/run.cmd` | wn 呼叫的批次檔，把 Node 26 放到 PATH 最前面 |
| `scripts/killport` | 結束佔用某個連接埠的 Windows 行程：`killport 3000` |
| `scripts/shot.cjs` | 開一個網址截圖，可加點擊、等待、按鍵等步驟 |
| `scripts/sheet.cjs` | 把多張截圖並排成一張，一次檢查多個畫面或多種語言 |

常用指令（都從專案根目錄，`W=.claude/skills/new-mini-game/scripts`）：

```bash
$W/wn node_modules/nuxt/bin/nuxt.mjs typecheck          # 型別
$W/wn node_modules/eslint/bin/eslint.js .               # lint
$W/wn node_modules/vitest/vitest.mjs run                # 單元測試
$W/wn node_modules/@playwright/test/cli.js test --reporter=line   # E2E（會自己啟動 npm run dev）
$W/wn node_modules/nuxt/bin/nuxt.mjs build              # 正式版 build（輸出 .output/）
$W/wn node_modules/nuxt/bin/nuxt.mjs dev --port 3000    # 開發伺服器（用 run_in_background）
$W/wn node_modules/wrangler/bin/wrangler.js dev --port 8787   # 用 workerd 跑正式版（先 build）
```

注意事項：

- 專案根目錄有一個**只存在本機**的 `.nvmrc`（內容 `26.13.1`，已加進 `.git/info/exclude`）。engines 要求 Node 24，但 Windows 只裝了 26；沒有這個檔，nvm-windows 的 shim 會報「Node.js v>=24.0.0 <25 is not installed」。不要把它 commit。
- Nuxt 的快取在 `.nuxt/`、建置結果在 `.output/`；遇到怪錯誤先刪掉這兩個再啟動。
- E2E 的 `workers` 固定為 2：所有測試共用一台開發伺服器，平行數量太多時，編譯和 Phaser 會搶 CPU，每次失敗的測試都不一樣（逾時、找不到元素）。遇到這種情況，先降低平行數重跑，再判斷是不是真的有錯。
- E2E 一律從 `tests/e2e/fixtures.ts` 匯入 `test`：`page.goto`／`reload` 之後會等網站接手（`html[data-hydrated]`）。Vue 不會補做接手前的點擊（React 19 會），測試太早點會沒反應。
- 截圖和暫存檔放 `.scratch/`（已在 exclude），不要放進 repo。
- 用 npx 從 npm 下載套件（例如 Lighthouse）會被權限擋下；不要繞過，改請使用者自己執行。

## 6. 上一款踩過的坑

| 症狀 | 原因 | 正確做法 |
|---|---|---|
| 過站後遊戲畫面整個變黑 | 用 `key` 重播震動動畫，連帶把裝著 Phaser 畫布的節點重新掛載 | 畫布外層不要用 key 重掛；用 ref 移除再加回 CSS class 重播動畫 |
| 圖片載入失敗卻沒有錯誤畫面 | Phaser 的 `loaderror` 之後仍會觸發 `complete`，把狀態改回「就緒」 | 記一個 failed 旗標，失敗後不讓 ready 覆蓋 |
| 伺服器產生的畫面和瀏覽器不一致（hydration mismatch） | 在 setup 直接讀 localStorage、時區、matchMedia | 瀏覽器端的值用 `app/composables/store.ts` 的 `useClientValue`／`useMediaQuery`／`useExternalStore`（接手後才換成實際值）；本機紀錄這類共用狀態放 lib 的訂閱式 store |
| 不存在的網址回 200 | （Next.js 時期）串流後改不了狀態碼 | 現在由 `server/middleware/site-routes.ts` 在渲染前比對目錄回 404，頁面也用 `definePageMeta({ validate })` |
| 開發伺服器把 /games/<slug> 轉到結尾加斜線 | `public/games/<slug>/` 資料夾和頁面同名 | `modules/dev-public-dir.ts`（只在 dev）；正式站由 wrangler.jsonc 的 `html_handling` 處理 |
| 圓體字型非常大 | Chiron GoRound TC 的可變字重在 Google Fonts 只有 TTF（@nuxt/fonts 預設只收 WOFF2，會整個漏掉） | nuxt.config.ts 對這一款另外允許 ttf；是否自行託管 WOFF2 待使用者決定 |
| 手機上音譯名稱被截斷 | 5 欄橫排一欄只有約 62 px，「Sakurazaka」放不下 | 非 CJK 語言在手機改直排清單，或名稱上下交錯；設計時就用最長語言檢查 |
| 誤差 0 顯示「−0 cm」 | 正負號判斷沒處理 0 | 先四捨五入到顯示單位再決定符號；0 另外給文字 |
| 放大鏡頭後名稱牌被角色擋住 | 牌子跟著背景一起放大 | 放大時淡出，資訊改由固定在角落的標籤提供 |
| 封面圖造成主控台警告 | 圖片只用 CSS 改了寬或高 | 外框決定大小，圖片 `absolute inset-0 size-full object-cover` 填滿 |
| 小圓點變成細線 | inline 元素的寬高不生效 | 用 `block` 或放在 flex 容器裡 |
