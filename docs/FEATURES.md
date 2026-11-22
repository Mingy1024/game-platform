# 功能清單

狀態：✅ 已完成並合併進 `main`（皆尚未部署到正式環境）、🚧 開發中、⏸ 預留未開。驗收條目編號對應 `docs/acceptance/precise-stop.md`。

| 功能 | 狀態 | 備註 |
| --- | --- | --- |
| 全站車站主題外框、七種語言 | ✅ | |
| 遊戲目錄、分類、熱門榜 | ✅ | 目前只有一款遊戲 |
| 精準停車（今日挑戰／自由模式） | ✅ | Phaser 4，一局 5 站 |
| 音效、背景音樂（City Pop）、靜音鈕 | ✅ | 音樂與音效分開開關 |
| 成績連結與成績圖 | ✅ | `/games/<slug>/r/<代碼>`、`/card` |
| Google 登入、隨機暱稱、自訂暱稱 | ✅ | |
| 精準停車紀錄接上帳號 | ✅ | P 組 21 條 |
| 全站排行榜（含訪客、歐盟先問同意） | ✅ | T 組 24 條；Codex 審查 7 項已修 |
| 累計發車次數 | ⏸ | `FEATURE_PLAY_COUNT`，版位已做、後端未接 |
| 廣告版位 | ⏸ | `ADS_MODE=mock` 只顯示示意 |
| 下班逃離辦公室 | 🚧 | 素材在 `public/games/office-escape/`（未追蹤），設計稿 v3 |
| 深海打撈員 | 🚧 | 設計稿階段 |

## 網站與語言

- 語言：繁中（無前綴）、簡中 `/zh-cn`、`/en`、`/ja`、`/ko`、`/vi`、`/pt`。首頁 `/` 依 cookie `gs-locale`（使用者自己選的語言，不看瀏覽器語言）轉址；查詢參數（例如 `?login=`）一起帶過去。
- 只有繁中的頁面：categories、hot、me、about、contact、privacy、terms。其他語言的這些網址回 404。
- 不存在的網址由 `server/middleware/site-routes.ts` 回 404，顯示「這一站沒有停靠」。
- 成績代碼只接受 `[A-Za-z0-9_-]{1,64}`。

## 精準停車

- 玩法：按住煞車、放開滑行，讓列車停進目標區；一局 5 站，雨天煞車力乘以 0.75（數值集中在 `lib/games/precise-stop/config.ts`）。
- 計分：誤差 ≤0.05 完美、≤0.3 很好、≤1 好、≤2 還可以；連擊誤差 ≤0.3 才累積；每超時一秒扣 50 分。
- 模式：今日挑戰（以台灣日期為種子，每天一組路線）、自由模式。
- 輸入：觸控、滑鼠、鍵盤；直式 3:4。
- 玩家按「出發」才下載 Phaser。

## 帳號與登入

- 只有 Google 登入（`FEATURE_LOGIN` 預設打開）；只存 `sub`，不存名字、信箱、大頭貼。
- 登入結果以 `?login=ok|error` 回到原頁（`return-path.ts` 只允許站內路徑）；取消授權、state 不符、cookie 過期都算 `error`。
- 暱稱：預設隨機（形容詞＋名詞＋四位數字，各語言顯示自己的翻譯）。自訂暱稱 2–12 個字（以使用者看到的字數算，emoji 組合算一個）、NFKC 正規化、只允許中英日韓文字、數字、空格與 `· ・ ー - _ .`；擋重複（`nick_key`）、擋髒話（`words.ts`）、**7 天只能改一次**，改回隨機不受限。錯誤碼：`length`、`chars`、`blocked`、`taken`、`too_soon`、`conflict`、`rate`。限流每人每分鐘 5 次。訪客不能改暱稱。
- 刪除帳號：刪玩家，session 與各遊戲紀錄 CASCADE 一起刪。
- 登出會清掉本機的紀錄（P 組）。

## 精準停車紀錄同步

- 本機先存、之後送：登入（或成為訪客）後，前端把本機最佳紀錄與完美次數 `POST /records/sync`，伺服器取高分合併，回傳合併後的紀錄（今日挑戰最近 14 天、自由模式、完美次數），換裝置看到同一份。
- 請求：`{ syncId, playerId, bests: [{ mode, dateKey, score, achievedAt }], perfectDelta, consent? }`。`syncId` 是前端產生的批次代碼，同一批重送不會重複加完美次數（觸發器保證）。
- 取高分：分數較高、或同分但較早創下者勝。
- 錯誤：`400 bad_request`（格式或分數範圍不對，整批不收）、`401`、`403 origin`／`consent_required`、`409 account_mismatch`（`playerId` 與目前身分不同，什麼都不寫）、`411`／`413`、`429 rate`（每人每分鐘 30 次）、`503 unavailable`。
- `GET /records?player=` 只讀，不做合併或清 cookie（避免外站觸發寫入）。
- 詳細的並行與重送規則見 `docs/dev/sync-checklist.md`。

## 排行榜

- 三張榜：`daily`（今天的今日挑戰最佳分）、`week`（本週，台灣週一 0 點至週日 24 點，今日挑戰單局最高分）、`free`（自由模式歷史最佳）。每人每張榜只出現一次；同分先創下的在前。
- `GET /leaderboard?scope=`：前 100 名（畫面先顯示 10 名），回應不含玩家 ID 或個人資料（頭像色只回編號）。在 Cloudflare 邊緣快取 60 秒，header `X-Leaderboard-Cache: hit|miss`。無效 `scope` 回 400。
- `GET /leaderboard/me?scope=&player=`：自己的名次 `{ rank, score, total, toTop100 }`，現算不快取；沒有成績時 `rank`、`score` 為 `null`；`player` 與目前身分不同回 409。
- 訪客：未登入也能上榜。第一次同步時由伺服器建立訪客並發 `gs_guest` cookie；同一個 `syncId` 重送會找回同一個訪客（回應掉了也不會重複建）。同一個 IP 每分鐘最多建 3 個（`GUEST_LIMITER`）。
- 歐盟地區（歐洲經濟區、英國、瑞士，依 Cloudflare 國家碼）要先問同意：沒帶 `consent` 回 `403 consent_required`；使用者選擇存在本機 `game-station:leaderboard-consent`，可在結算、排行榜或我的紀錄頁改。
- 登入時訪客併進帳號：最佳紀錄取高分、完美次數相加、處理過的批次代碼搬過去；單一 D1 batch，重複執行不會多加。併失敗不影響登入，`GET /api/me` 回 `guestPending: true`，前端再 `POST /api/me/guest-merge` 重試。
- 訪客可 `DELETE /api/guest` 刪除自己的紀錄；90 天沒送成績的訪客每日排程自動刪除。
- 全站排行需要 `FEATURE_LOGIN` 與 `FEATURE_LEADERBOARD` 同時打開，關掉時相關 API 回 `404 not_found`。

## 成績分享

- 玩完得到成績代碼（`lib/games/precise-stop/share-code.ts`）；`/games/<slug>/r/<代碼>` 顯示成績頁，`/card` 回 PNG（satori + resvg，字型由 `scripts/fetch-share-fonts.mjs` 取得，圖片用完釋放記憶體）。
- 範圍外或格式錯誤的代碼回 404。
