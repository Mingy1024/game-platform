# 遊戲累計遊玩次數：實作計畫

- 開始日期：2026-11-28
- 狀態：已實作並驗收（2026-11-28）：單元測試、lint、typecheck、E2E 全過（E2E 全部跑時 office-escape P10 mobile 逾時一次，單獨重跑通過）。開關 `FEATURE_PLAY_COUNT` 預設關閉；確認後移到 docs/plans/archive/
- 驗收標準：`docs/acceptance/play-count.md`
- 使用者決定（2026-11-28）：玩完一局才算、失敗不重送、門檻 100、照 `.claude/rules/database-api.md` 帶批次代碼

## 這是什麼

記錄「所有玩家加起來，這款遊戲總共被玩了幾次」，顯示在各遊戲介紹頁。**就是單純的遊玩次數**，畫面文字與程式命名都不配合各遊戲的主題（不再用「發車」「下班」「逃生」）。

## 設計（預設值，等確認）

| 項目 | 決定 | 理由 |
|---|---|---|
| 一次怎麼算 | 玩完一局、出現結算畫面時 +1；中途離開、重新開始不算 | 不容易被重新整理灌水 |
| 範圍 | 每款遊戲各自累計（不做全站加總） | 介紹頁只顯示該款遊戲的數字 |
| 精確度 | **約略的熱度數字**，不是精確統計：送出失敗不重送、不排隊 | 偶爾少算，不會多算 |
| 擋重複 | 每局一個隨機代碼 `runId`；`play_count_batches` 用 `INSERT OR IGNORE` 記代碼，觸發器在同一個 SQL 動作裡加一 | `.claude/rules/database-api.md`：會增加的寫入一定帶代碼（使用者 2026-11-28 選擇照規則做） |
| 代碼保留 | 2 天，每日排程清掉 | 前端不重送，2 天足夠涵蓋網路層的重試；sync-checklist 第 3 節「保留得跟前端可能重送的時間一樣久」 |
| 存哪裡 | D1 `play_counts(game, count)` 與 `play_count_batches(run_id, game, created_at)`，migration `0007`；**不存玩家 ID、IP**，代碼表的時間只用來清理 | CLAUDE.md：DB 只存基本功能需要的資料 |
| 寫入 | `POST /api/play-count/<slug>`，內容 `{ runId }`，包 `guarded(…, { playCount: true })`（檢查 Origin、看 `FEATURE_PLAY_COUNT` 而不是登入開關）；觸發器 `INSERT ... ON CONFLICT(game) DO UPDATE SET count = count + 1` | sync-checklist 第 1 節「只在鎖裡讀改寫」＝伺服器端條件更新 |
| 防刷 | 新增限流 binding `PLAYS_LIMITER`（`wrangler.jsonc`，同一個 IP 1 分鐘 10 次）；slug 只接受 `lib/catalog` 裡的遊戲；超過回 429 | 約略數字也不該讓人用腳本灌 |
| 讀取 | `GET /api/play-count/<slug>`（沒有寫入副作用），回 `{ count }`；介紹頁載入後才顯示，失敗就不顯示 | sync-checklist 第 1 節：GET 不能有副作用 |
| 顯示門檻 | 少於 N 次不顯示（N 待確認，建議 100） | 剛上線數字太小，反而沒說服力 |
| 開關 | 沿用 `FEATURE_PLAY_COUNT`（建置時決定，預設關閉） | 已有的機制 |
| 文字 | 七種語言字典的 `playCount` 改成不帶主題的句子，例如 zh-TW「已被玩 {count} 次」、en「Played {count} times」 | 三款遊戲共用同一句；`dictionaries.test.ts` 會檢查七種語言齊全 |
| 命名 | `PlayCountChip`、`EscapePlayCount`、`MinePlayCount` 合併成一個共用的 `PlayCount` 元件；拿掉「預留」標籤與假數字 `sample` | 三份重複 |

## sync-checklist 對照

### 第 1 節：共用狀態與寫入者

| 狀態 | 存在哪裡 | 誰會寫 | 怎麼避免同時寫 |
|---|---|---|---|
| 遊戲遊玩總數 | D1 `play_counts` | 只有觸發器 `play_count_batches_apply` | 觸發器裡 `ON CONFLICT DO UPDATE SET count = count + 1`，和記代碼同一個 SQL 動作 |
| 擋重複代碼 | D1 `play_count_batches` | `POST /api/play-count/<slug>`（`INSERT OR IGNORE`）、每日排程（刪 2 天前） | 主鍵 `run_id`；重複的代碼被忽略 |
| 瀏覽器端 | **沒有**（不寫 localStorage、不排隊） | — | — |

### 第 2 節：結果表

| 結果 | 處理 |
|---|---|
| 沒有回應、逾時 | 不重送；這一次不計入（接受少算） |
| 伺服器已寫入但回應沒收到 | 不重送；就算網路層重送，同一個代碼也只加一次 |
| 400（slug 不是遊戲） | 不重送 |
| 401 | 此 API 不需登入，不會出現 |
| 403（Origin 不對）、429（限流）、5xx | 不重送；這一次不計入 |
| 回應晚到、已登出或換帳號 | 沒有帳號關聯，不受影響 |
| 送到一半頁面關掉 | 可能少算一次，接受 |

### 第 3 節：增加的寫入擋重複

每局帶一個前端產生的代碼（`randomId(24)`）。伺服器記代碼與加一由觸發器在同一個 SQL 動作完成，重複的代碼不加。另外每局只在結算事件送**一次**（精準停車、下班逃離辦公室的 `final` 事件；礦坑大逃亡 phase 變成 `over` 的那一格），失敗不重送。代碼保留 2 天：前端不重送，只需涵蓋網路層的重試。

### 第 4 節：並行

| 來源 | 結果 |
|---|---|
| 同一瀏覽器多分頁 | 各自玩各自算，加總正確 |
| 同帳號多裝置 | 沒有帳號關聯，各自算 |
| 同時多個請求 | 觸發器原子加一，不會少算（單元測試 20 個並行） |

### 第 7 節：登入狀態

此功能**不看登入**、不存玩家 ID，登出、刪除帳號、換帳號、401 都沒有影響；刪除帳號也沒有東西要刪（計數表不含個人資料）。

## 實作位置

| 層 | 位置 |
|---|---|
| 純邏輯與 SQL | `lib/play-count/index.ts`（slug 與 runId 檢查、門檻、`recordPlay`、`readPlayCount`、清理 SQL）、`lib/play-count/client.ts`（回報與讀取） |
| 資料庫 | `prisma/schema.prisma` 的 `PlayCount`、`PlayCountBatch`；`migrations/0007_add_play_counts.sql`（含手寫觸發器） |
| 伺服器 | `server/api/play-count/[slug].post.ts`、`[slug].get.ts`；`guarded()` 新增 `playCount` 選項；`PLAYS_LIMITER`；每日排程清代碼 |
| 畫面 | `app/components/ui/PlayCount.vue`（取代三個各遊戲的版位元件）；三款遊戲結算時呼叫 `reportPlay` |
| 文字 | 七種語言字典最上層的 `playCount`；拿掉各遊戲的 `playCount` 與 `nav.reserved` |
| 隱私頁 | `app/pages/privacy.vue`「遊玩次數統計」依開關顯示實際收集的資料 |
| 測試 | 單元 `lib/play-count/__tests__/play-count.test.ts`；E2E `tests/e2e/play-count.spec.ts`、`site.spec.ts` L2 L3、各遊戲的 L2 與「玩完一局只回報一次」 |

## 上線步驟

1. 正式 D1 先套 migration 0007：`npm run db:migrate:remote`。
2. 用 `FEATURE_PLAY_COUNT=1` 建置部署（順序不能反，不然 API 會因為沒有資料表回 500）。
