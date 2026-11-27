# 遊戲累計遊玩次數：實作計畫

- 開始日期：2026-11-28
- 狀態：計畫草稿，等使用者確認「算法」與「門檻」後再寫程式
- 驗收標準：確認後補 `docs/acceptance/play-count.md`

## 這是什麼

記錄「所有玩家加起來，這款遊戲總共被玩了幾次」，顯示在各遊戲介紹頁。**就是單純的遊玩次數**，畫面文字與程式命名都不配合各遊戲的主題（不再用「發車」「下班」「逃生」）。

## 設計（預設值，等確認）

| 項目 | 決定 | 理由 |
|---|---|---|
| 一次怎麼算 | 玩完一局、出現結算畫面時 +1；中途離開、重新開始不算 | 不容易被重新整理灌水 |
| 範圍 | 每款遊戲各自累計（不做全站加總） | 介紹頁只顯示該款遊戲的數字 |
| 精確度 | **約略的熱度數字**，不是精確統計：送出失敗不重送、不排隊 | 不重送就不會重複加，免掉 sync-checklist 第 3 節的批次代碼與擋重複紀錄 |
| 存哪裡 | D1 一張表 `play_counts(game TEXT PRIMARY KEY, count INTEGER NOT NULL)`，migration `0007`；只存「遊戲代號＋總數」，**不存玩家 ID、IP、時間** | CLAUDE.md：DB 只存基本功能需要的資料 |
| 寫入 | `POST /api/play-count/<slug>`，包 `guarded()`（檢查 Origin、功能旗標）；`INSERT ... ON CONFLICT(game) DO UPDATE SET count = count + 1`（同一個 SQL，並行不會少算） | sync-checklist 第 1 節「只在鎖裡讀改寫」＝伺服器端條件更新 |
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
| 遊戲遊玩總數 | D1 `play_counts` | `POST /api/play-count/<slug>`（結算時由前端送） | 同一個 SQL `ON CONFLICT DO UPDATE SET count = count + 1` |
| 瀏覽器端 | **沒有**（不寫 localStorage、不排隊） | — | — |

### 第 2 節：結果表

| 結果 | 處理 |
|---|---|
| 沒有回應、逾時 | 不重送；這一次不計入（接受少算） |
| 伺服器已寫入但回應沒收到 | 不重送，所以不會重複加 |
| 400（slug 不是遊戲） | 不重送 |
| 401 | 此 API 不需登入，不會出現 |
| 403（Origin 不對）、429（限流）、5xx | 不重送；這一次不計入 |
| 回應晚到、已登出或換帳號 | 沒有帳號關聯，不受影響 |
| 送到一半頁面關掉 | 可能少算一次，接受 |

### 第 3 節：增加的寫入擋重複

用「不重送」取代批次代碼：每局結算只送**一次**，結算畫面重新渲染、分頁切換都不再觸發（以「這一局的結算」為單位送，用記憶體旗標防重複）。代價：偶爾少算，不會多算。

### 第 4 節：並行

| 來源 | 結果 |
|---|---|
| 同一瀏覽器多分頁 | 各自玩各自算，加總正確 |
| 同帳號多裝置 | 沒有帳號關聯，各自算 |
| 同時多個請求 | SQL 原子加一，不會少算 |

### 第 7 節：登入狀態

此功能**不看登入**、不存玩家 ID，登出、刪除帳號、換帳號、401 都沒有影響；刪除帳號也沒有東西要刪（計數表不含個人資料）。

## 要做的事

1. migration `0007_add_play_counts`（`prisma/schema.prisma` 加 model 後用 `npm run db:migration -- add_play_counts` 產生）。
2. `lib/play-count/`：slug 驗證、門檻判斷（純邏輯）＋單元測試。
3. `server/api/play-count/[slug].post.ts`、`[slug].get.ts`＋ `server/utils/play-count.ts`。
4. `wrangler.jsonc` 加 `PLAYS_LIMITER`，`npm run cf:typegen`。
5. 前端：共用 `PlayCount` 元件；三款遊戲結算時送一次。
6. 七種語言字典改句子。
7. 測試：單元（門檻、slug）、API（限流、Origin、非法 slug、原子加一）、E2E（結算只送一次、失敗不重送、低於門檻不顯示、開關關閉不顯示）。
8. 文件：`FEATURES.md`、`ARCHITECTURE.md`（API 與資料表）、`CHANGELOG.md`、`launch-checklist.md`。
9. 部署時：先 `db:migrate:remote`（正式 D1 要套 `0007`），再用 `FEATURE_PLAY_COUNT=1` 建置。
