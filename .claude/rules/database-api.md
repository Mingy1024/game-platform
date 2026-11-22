---
paths:
  - "prisma/**"
  - "migrations/**"
  - "server/api/**"
  - "server/routes/**"
  - "server/utils/**"
  - "lib/account/**"
---

# 資料庫與 API 規則

## 資料庫（D1／SQLite）
- 改 `prisma/schema.prisma` 後：`npm run db:migration -- <名稱>` → `npm run db:migrate:local` → `npm run db:generate`。
- 已存在的 `migrations/*.sql` 不改，要改就加新的一支；`generated/` 是自動產生的，不手改。
- schema 每個欄位寫 `///` 註解；欄位 `@map` 成 snake_case、表名 `@@map` 成複數 snake_case。
- 對外只用 `players.id`，不用 `google_sub`；不存名字、信箱、大頭貼。初期只存基本功能需要的資料，不加稱號。
- 「會增加」的寫入（計數、累加）一定帶前端產生的批次代碼，且記代碼與累加在同一個 SQL 動作（觸發器或同一個 batch）；用 `ON CONFLICT … WHERE` 做條件更新。
- 多個語句要一起成功或一起失敗時用 `D1Database.batch`。
- 正式環境（`db:migrate:remote`）使用者要求才跑。

## API
- 會改資料的 handler 一律 `guarded(event, …)`：檢查 Origin（只有 GET 與 OAuth 回呼用 `checkOrigin: false`）、轉 401／500、處理功能旗標；排行榜／訪客類加 `leaderboard: true`。
- GET 不能有寫入副作用（合併、刪除、清 cookie）。需要重試的寫入改成同源 POST。
- 成功 `noStore(event, body)`；失敗 `jsonError(event, 狀態碼, "snake_case 代碼")`，格式 `{ error, ...extra }`，不洩漏內部錯誤訊息。
- 讀請求內容用 `readJsonBody(event, 上限)`，並處理 411／413／400；先限流再讀內容。
- 身分用 `requireSessionPlayer`（只認 Google）或 `resolveIdentity`／`guestPlayer`；請求帶的 `playerId` 與目前身分不同回 409 `account_mismatch`、什麼都不寫。
- 限流用 `checkRateLimit`：`unavailable` 一律拒絕（503），不默默放行。
- 檔頭註解寫清楚請求格式、回應格式與每個錯誤碼的情境。
- 共用狀態、會增加的寫入、登入登出相關改動，先照 `docs/dev/sync-checklist.md`。
