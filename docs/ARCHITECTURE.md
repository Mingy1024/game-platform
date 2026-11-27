# 架構

## 總覽

- 前端：Nuxt 4 + Vue 3（`<script setup>`）+ Tailwind CSS 4。元件用檔名直接使用（`pathPrefix: false`）。
- 遊戲：Phaser 4，只在瀏覽器端、玩家按「出發」後才動態載入（`app/games/precise-stop/`）。
- 伺服器：Nitro，preset `cloudflare_module`，輸出到 `.output/`（Worker 在 `.output/server`、靜態檔與預先產生的頁面在 `.output/public`）。
- 資料庫：Cloudflare D1（SQLite），Prisma 7 + `@prisma/adapter-d1`；Client 產生到 `generated/prisma/`（`runtime = "workerd"`）。
- 成績圖：satori + resvg（WebAssembly）在 Worker 上產生 PNG。
- `@` 別名指向專案根目錄（`nuxt.config.ts`、`vitest.config.mts` 一致）。

## 目錄結構

```
app/                      Nuxt 前端
  app.vue、error.vue      根元件、404／錯誤頁（「這一站沒有停靠」）
  assets/css/main.css     Tailwind 入口與全站樣式
  components/             元件（account/、catalog/、layout/、precise-stop/、office-escape/、mine-descent/…）
  composables/            locale、login、seo、store、useMe
  games/precise-stop/     Phaser 場景（scene.ts）、音效（sound.ts）、標籤（labels.ts）、共用（shared.ts）
  games/office-escape/    three.js 場景（scene.ts）、角色庫（characters.ts，設計稿 F1 移植）、音效（sound.ts）、共用（shared.ts）
  games/mine-descent/     Phaser 4 場景（scene.ts）、程式產生的 SVG 美術（art.ts）、音效（sound.ts）、共用（shared.ts）
  layouts/default.vue     車站主題外框
  middleware/locale-home.global.ts  首頁語言轉址（前端導航）
  pages/                  路由頁面（[locale]/ 是其他語言的前綴版本）
  plugins/                account-sync.client.ts（登入後同步紀錄）、hydrated.client.ts
  utils/route-checks.ts
  dev/                    只在開發用的 stub（devtools-api-stub.ts）
lib/                      與框架無關的 TypeScript（可直接單元測試）
  account/                session、player、nick、guest、google、guest-merge、leaderboard-consent…
  catalog/                遊戲目錄（catalog.ts）、分類、熱門榜、manifest schema（zod）
  games/precise-stop/     物理、計分、路線、自動駕駛、紀錄、排行榜、成績代碼、分享卡
  games/office-escape/    固定路線與隨機、模擬（固定步長）、計分、自動駕駛、紀錄與同步（pending／inbox）、排行榜、成績代碼、分享卡
  games/mine-descent/     岩板產生（保證有路）、模擬（固定步長）、計分、自動駕駛、紀錄與同步（pending／inbox）、排行榜（最深／最高分）、成績代碼、分享卡
  i18n/                   七種語言（locales.ts）與字典（dictionaries/）
  flags.ts                功能開關（建置時決定）
  routes.ts               網站有哪些網址（404 判斷與預先產生清單共用）
  site-metadata.ts、icons.ts、sound-pref.ts
server/
  api/                    API 路由（見下方總覽）
  routes/                 成績圖 /games/<slug>/r/<代碼>/card（含各語言前綴版本）
  middleware/site-routes.ts   首頁語言轉址、不存在的網址回 404
  plugins/session-cleanup.ts  每日排程清理
  utils/                  account、guest、rate-limit、cloudflare、prisma、json-body、leaderboard、og-image…
  cloudflare-entry.ts     正式建置的 Workers 入口（讀內容前先檢查大小）
  body-limit.ts           請求大小限制
prisma/schema.prisma      D1 schema；prisma7.config.ts 為 Prisma CLI 設定
migrations/               D1 migrations（0001–0005），由 wrangler 套用
generated/prisma/         Prisma Client（自動產生，不手改）
scripts/                  check-site-url、db-migration、fetch-share-fonts
tests/e2e/                Playwright 測試與假的 Google（fake-google.mjs）
public/games/             遊戲素材（precise-stop/、office-escape/、mine-descent/）
docs/                     文件（acceptance/、dev/、sound/、plans/）
wrangler.jsonc            Cloudflare 設定（D1、限流、排程、靜態資源）
```

## 頁面產生方式

| 類型 | 頁面 | 說明 |
| --- | --- | --- |
| 建置時預先產生 | 遊戲列表、分類、熱門榜、關於等資訊頁、各語言首頁與遊戲介紹頁 | 清單在 `lib/routes.ts` 的 `prerenderRoutes()`，從 `ASSETS` 靜態資源直接提供 |
| 請求時產生（Worker） | 繁中首頁 `/`、成績連結 `/games/<slug>/r/<代碼>`、我的紀錄、帳號設定 | `/` 要先看語言 cookie `gs-locale`；成績代碼是任意值 |
| 成績圖 | `/…/r/<代碼>/card` | satori + resvg 產生 PNG |

`wrangler.jsonc` 的 `html_handling: drop-trailing-slash`，讓 `/games/precise-stop` 直接對到預先產生的頁面。

## 語言

`zh-TW`（預設，網址無前綴）、`zh-CN`（`/zh-cn`）、`en`、`ja`、`ko`、`vi`、`pt`。`zh-TW` 專屬頁面（categories、hot、me、about、contact、privacy、terms）其他語言不開放；其他語言只開放有翻譯的頁面（`lib/routes.ts` 的 `translatedOnly`）。

## 認證與授權

- **Google 登入**：OAuth + PKCE（`arctic`）。`/api/auth/google/start` 存 `state`／`verifier`／`returnPath` 到 httpOnly cookie，`callback` 比對 state、換 token，只取 ID token 的 `sub`，找或建 `players`，建立 session。回呼不檢查 Origin（一般頁面跳轉），改用 state 防偽造。
- **Session**：cookie `gs_session` 存隨機 token，資料庫 `sessions.id` 只存其 SHA-256。有效 400 天，剩不到 200 天時使用就延長（同時更新 cookie 期限）；最後使用時間一天最多更新一次。
- **訪客**：cookie `gs_guest`，與 Google 共用 `sessions` 表，以 `players.kind = 'guest'` 區分；只在排行榜開啟時建立。登入時併進帳號（`mergeGuest`，單一 D1 batch）。
- **CSRF**：會改資料的 API 由 `guarded()` 檢查 `Origin` 等於本站；cookie 為 `SameSite=Lax`、`HttpOnly`、https 時加 `Secure`。
- **功能開關**：`FEATURE_LOGIN` 關閉時所有帳號 API 回 404 `not_found`；排行榜與訪客 API 另外需要 `FEATURE_LEADERBOARD`。
- **限流**（`wrangler.jsonc` 的 `ratelimits`，各資料中心分開計數）：`NICK_LIMITER` 每人每分鐘 5 次、`RECORDS_LIMITER` 30 次、`GUEST_LIMITER` 每 IP 每分鐘 3 個訪客、`PLAYS_LIMITER` 每 IP 每分鐘回報 10 局遊玩次數。正式環境沒有 binding 或出錯時回 503，不默默放行；本機開發沒有 binding 時不限制。

## API 路由總覽

| 方法與路徑 | 檔案 | 認證 | 說明 |
| --- | --- | --- | --- |
| GET `/api/auth/google/start` | `server/api/auth/google/start.get.ts` | 無 | 導向 Google，存 state |
| GET `/api/auth/google/callback` | `…/callback.get.ts` | state | 建 session、併入訪客、導回原頁（`?login=ok\|error`） |
| POST `/api/auth/logout` | `…/logout.post.ts` | session | 登出 |
| GET `/api/me` | `server/api/me/index.get.ts` | 選用 | 目前玩家資訊（含 `guestPending`） |
| DELETE `/api/me` | `index.delete.ts` | Google | 刪除帳號（CASCADE 刪紀錄） |
| PATCH `/api/me/nick` | `nick.patch.ts` | Google | 自訂暱稱或改回隨機 |
| POST `/api/me/guest-merge` | `guest-merge.post.ts` | Google | 重試把本瀏覽器訪客併進帳號 |
| DELETE `/api/guest` | `server/api/guest/index.delete.ts` | 訪客 cookie | 刪除訪客與紀錄 |
| GET `/api/games/precise-stop/records` | `…/records/index.get.ts` | Google／訪客 | 讀帳號紀錄（只讀） |
| POST `/api/games/precise-stop/records/sync` | `…/records/sync.post.ts` | Google／訪客／建立訪客 | 合併本機紀錄 |
| GET `/api/games/precise-stop/leaderboard?scope=` | `…/leaderboard/index.get.ts` | 無 | 前 100 名，邊緣快取 60 秒 |
| GET `/api/games/precise-stop/leaderboard/me` | `…/leaderboard/me.get.ts` | Google／訪客 | 自己的名次 |
| GET `/api/games/office-escape/records` | `server/api/games/office-escape/records/index.get.ts` | Google／訪客 | 讀帳號紀錄（只讀） |
| POST `/api/games/office-escape/records/sync` | `…/records/sync.post.ts` | Google／訪客／建立訪客 | 合併本機最佳（取高分，重送冪等） |
| GET `/api/games/office-escape/leaderboard?scope=daily\|week\|all` | `…/leaderboard/index.get.ts` | 無 | 前 100 名，邊緣快取 60 秒 |
| GET `/api/games/office-escape/leaderboard/me` | `…/leaderboard/me.get.ts` | Google／訪客 | 自己的名次 |
| GET `/api/games/mine-descent/records` | `server/api/games/mine-descent/records/index.get.ts` | Google／訪客 | 讀帳號紀錄（只讀） |
| POST `/api/games/mine-descent/records/sync` | `…/records/sync.post.ts` | Google／訪客／建立訪客 | 合併本機最佳（取高值，重送冪等） |
| GET `/api/games/mine-descent/leaderboard?scope=score\|depth` | `…/leaderboard/index.get.ts` | 無 | 前 100 名，邊緣快取 60 秒 |
| GET `/api/games/mine-descent/leaderboard/me` | `…/leaderboard/me.get.ts` | Google／訪客 | 自己的名次 |
| GET `/api/play-count/<slug>` | `server/api/play-count/[slug].get.ts` | 無 | 累計遊玩次數 `{ count }`（只讀；`FEATURE_PLAY_COUNT` 關閉時 404） |
| POST `/api/play-count/<slug>` | `…/[slug].post.ts` | 無（檢查 Origin） | 玩完一局 +1，內容 `{ runId }`；同一個代碼只加一次 |

### 回應格式

- 成功：直接回 JSON 物件（沒有 `data` 包裝），`Cache-Control: no-store`（排行榜為 `no-cache`，快取只在 Cloudflare）。
- 失敗：`{ "error": "<代碼>", ...額外欄位 }`，狀態碼 400／401／403／409／411／413／429／503。常見代碼：`bad_request`、`unauthorized`、`origin`、`not_found`、`account_mismatch`、`consent_required`、`rate`、`unavailable`、`server`；暱稱另有 `length`、`chars`、`blocked`、`taken`、`too_soon`、`conflict`。
- 請求內容由 `server/utils/json-body.ts` 先檢查大小（`readJsonBody(event, maxBytes)` 回傳狀態碼 411／413／400 或 `{ body }`）。

## 資料庫 schema（D1／SQLite，`prisma/schema.prisma`）

### `players`
| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `id` | String PK | 隨機 21 字元，對外一律用它 |
| `kind` | String | `google` 或 `guest` |
| `google_sub` | String? unique | Google 帳號代碼；不存名字、信箱、大頭貼 |
| `nick_adj`／`nick_noun`／`nick_num` | Int | 隨機暱稱的編號（各語言顯示自己的翻譯） |
| `nick_custom` | String? | 自訂暱稱 |
| `nick_key` | String? unique | 正規化後的暱稱，擋重複 |
| `nick_changed_at` | DateTime? | 算 7 天冷卻 |
| `created_at`、`last_seen_at` | DateTime | |
| `last_played_at` | DateTime? | 最後送成績時間；90 天沒玩的訪客依它刪除 |
| `guest_sync_id` | String? unique | 訪客建立時的同步代碼，回應掉了重送可找回同一個訪客 |

索引：`(kind, last_played_at)`。

### `sessions`
`id`（token 的 SHA-256，PK）、`player_id`（FK → players，CASCADE）、`expires_at`、`created_at`；索引 `player_id`、`expires_at`。

### `precise_stop_bests`
PK `(player_id, mode, date_key)`；`mode` 為 `daily`／`free`，`date_key` 為台灣日期 `YYYY-MM-DD`（自由模式為空字串）；`score` Int、`achieved_at` DateTime（同分先創下的排前面）。索引 `(mode, date_key, score DESC)`。只存最佳，不存每局明細。

### `precise_stop_stats`
`player_id` PK、`perfect_stops` Int 預設 0、`updated_at`。

### `precise_stop_sync_batches`
PK `(player_id, sync_id)`、`perfect_delta`、`created_at`。**由觸發器 `precise_stop_sync_batches_apply`（migrations/0002 末尾）在新增列時，於同一個 SQL 動作內把 `perfect_delta` 加進 `precise_stop_stats`**，所以「批次已記錄」等於「次數已加過」。批次紀錄永久保留（前端可能隔很久才重送），刪帳號時一起刪。

### `office_escape_bests`
PK `(player_id, mode, date_key)`；`mode` 為 `daily`／`all`，`date_key` 為台灣日期（`all` 為空字串）；`score`、`achieved_at`。索引 `(mode, date_key, score DESC)`。**沒有累計次數、也沒有同步批次表**：只取高分，所以重送一定冪等（見 `docs/plans/archive/office-escape.md`）。訪客併進帳號時 `mergeGuest` 一起併這張表。

### `mine_descent_bests`
PK `(player_id, mode)`；`mode` 為 `score`（最高分）／`depth`（最深公尺）；`score`（那一種的數值）、`achieved_at`。索引 `(mode, score DESC)`。**沒有日期、累計次數與同步批次表**：只取高值，重送一定冪等（見 `docs/plans/archive/mine-descent.md`）。訪客併進帳號時 `mergeGuest` 一起併這張表。

### `play_counts`
PK `game`（遊戲 slug）、`count`。各遊戲累計遊玩次數（所有玩家加總）。**只存遊戲代號與總數，不存玩家、IP、時間**；程式不直接改，由下面的觸發器加一（見 `docs/plans/play-count.md`）。

### `play_count_batches`
PK `run_id`（前端每局產生的隨機代碼）、`game`、`created_at`，索引 `created_at`。**由觸發器 `play_count_batches_apply`（migrations/0007 末尾）在新增列時，於同一個 SQL 動作內把 `play_counts` 加一**；寫入用 `INSERT OR IGNORE`，重複的代碼不新增列、觸發器不跑。前端不重送，所以每日排程清掉 2 天前的代碼。

## 排程

`wrangler.jsonc` `triggers.crons = ["0 19 * * *"]`（台灣時間凌晨 3 點）→ `server/plugins/session-cleanup.ts`：刪過期 session、刪 90 天沒玩的訪客（`PURGE_GUESTS_SQL`，看 `last_played_at`，沒有則看 `created_at`）、刪 2 天前的遊玩次數代碼（`PURGE_PLAY_BATCHES_SQL`）。

## 建置時決定的值

`nuxt.config.ts` 把 `FEATURE_LOGIN`、`FEATURE_LEADERBOARD`、`FEATURE_PLAY_COUNT`、`ADS_MODE`、`SITE_URL` 用 `define` 寫死進程式，預先產生的頁面也依它們產生，改了要重新建置。舊名稱 `NEXT_PUBLIC_FEATURE_*` 仍認得。正式部署前後由 `scripts/check-site-url.mjs` 檢查 `SITE_URL` 與 canonical。

## 已知注意

- 正式建置用 `server/cloudflare-entry.ts` 取代 Nitro 預設入口，升級 nitropack 後要確認 `dist/presets/cloudflare/runtime/cloudflare-module.mjs` 還在（`npm run preview` 會失敗）。
- `*.workers.dev` 網域沒有 Cache API，排行榜邊緣快取要綁自己的網域才會生效。
- `wrangler.jsonc` 的 `database_id` 已填入正式 D1 的 ID（2026-11-28 建立，database_name 為 game-platform）。
