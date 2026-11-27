# 上線清單：先部署測試站（workers.dev），再轉正式網域

- 開始日期：2026-11-24
- 狀態：測試站（workers.dev）已上線並驗收（2026-11-28），第三段轉正式網域未做；部署與正式 D1 的指令，使用者明確要求才跑
- 測試站：https://game-platform.mingyo2410.workers.dev（`SITE_NOINDEX=1`）
- 做完後移到 docs/plans/archive/

## 一、部署前檢查

- [ ] **跑測試前先清掉部署用的環境變數**：`Remove-Item Env:SITE_URL, Env:SITE_NOINDEX -ErrorAction SilentlyContinue`（PowerShell 的 `$env:` 會留在同一個視窗，dev server 繼承後 og:image 會指到線上網站，成績圖測試會回 403；2026-11-28 發生過，清掉後重跑通過）
- [x] Windows Node 執行 `npm run typecheck`、`npm run lint`、`npm test`、`npm run test:e2e` 全過（WSL 缺 rolldown 原生套件，見記憶檔）。2026-11-28 e2e 只有上述 5 項失敗，清環境變數後重跑通過；typecheck、lint、單元測試也都通過（2026-11-28）
- [x] `npm run build` 後確認輸出的頁面有 `noindex, nofollow`，且 `/robots.txt` 是 `Disallow: /`（`SITE_NOINDEX=1` 建置；2026-11-28 線上實測 noindex 與 `Disallow: /` 正確）
- [x] 確認 `prisma/schema.prisma` 與 `migrations/0001`–`0006` 一致（2026-11-24 已核對）
- [ ] 確認 `GOOGLE_OAUTH_TEST_BASE_URL` 沒有設在正式環境

## 二、測試站（`*.workers.dev`）

- [x] 建立 D1（2026-11-28 完成，ID 已填入）：`wrangler d1 create game-platform`，把 ID 填進 `wrangler.jsonc` 的 `database_id`（目前是全零佔位）
- [x] 套 migration（2026-11-28 完成，0001–0006 全部成功）：`npm run db:migrate:remote`
- [x] 設 secret（2026-11-28）：`wrangler secret put GOOGLE_CLIENT_ID`、`wrangler secret put GOOGLE_CLIENT_SECRET`
- [x] Google Cloud Console：OAuth 用戶端加上 workers.dev 的授權導向網址（`https://game-platform.mingyo2410.workers.dev/api/auth/google/callback`）
- [x] 建置並部署（2026-11-28，版本 fe16d37d）：`SITE_URL=https://<名稱>.<子網域>.workers.dev SITE_NOINDEX=1 npm run cf:deploy`
- [x] 測試站手動驗收（2026-11-28，使用者確認正常）：七種語言首頁、三款遊戲能玩、Google 登入、改暱稱、紀錄同步、排行榜、成績連結與成績圖
- [x] 確認限流 binding 正常（部署輸出列出三個 Rate Limit binding）（`NICK_LIMITER`、`RECORDS_LIMITER`、`GUEST_LIMITER`；正式環境沒有 binding 會回 503）
- [x] 確認每日清理的 cron（UTC 19:00）有排程（部署輸出 schedule: 0 19 * * *）

## 三、轉正式網域

- [ ] 在 Cloudflare 綁自己的網域（workers.dev 沒有 Cache API，排行榜 60 秒邊緣快取要綁網域才會生效）
- [ ] Google Console：OAuth 用戶端加上正式網域的授權導向網址
- [ ] 重新建置並部署：`SITE_URL=https://<正式網域>`、`ADS_MODE=off`，**不要設 `SITE_NOINDEX`**（`SITE_URL`、`SITE_NOINDEX`、`ADS_MODE` 都是建置時寫死的；`ADS_MODE` 預設是 `mock`，沒設 `off` 會顯示「廣告」示意框）
- [ ] 確認 `/robots.txt` 是 `Allow: /`、頁面沒有 noindex、canonical 與 og:image 用正式網域
- [ ] 要打開累計遊玩次數時：先 `npm run db:migrate:remote` 套 migration 0007，再用 `FEATURE_PLAY_COUNT=1` 建置部署（順序不能反，不然 API 會 500）
- [ ] 決定測試期間的資料要不要清（D1 同一個資料庫，帳號與紀錄會保留；cookie 綁網域，登入與 `gs_guest` 訪客身分不會跟過去）
- [ ] 測試站處理：下架，或保留 noindex

## 四、尚未決定或可延後

- [ ] 韓文、越南文等語言請母語者確認（驗收 K6／K7 標「母語者確認待辦」）
- [x] 廣告：正式上線先關掉（2026-11-28 決定，建置用 `ADS_MODE=off`，隱私頁維持「目前沒有第三方廣告」）。之後要接真廣告（例如 AdSense）時：需要廣告帳號與網站審核、`AdSlot.vue` 補 live 模式、歐盟先問同意、更新隱私頁與七種語言文字
- [ ] 測試站目前是 `ADS_MODE=mock` 建置，會顯示示意框；要讓測試站也看不到的話，下次部署加 `ADS_MODE=off`
- [x] 累計遊玩次數：已實作（2026-11-28），開關預設關閉；要打開見第三段
- [x] 下班逃離辦公室、礦坑大逃亡：計畫已移到 archive（2026-11-28）
- [ ] 深海打撈員：設計稿階段，不影響上線
