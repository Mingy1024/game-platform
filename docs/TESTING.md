# 測試規範

兩層：**Vitest**（純邏輯與 SQL，快）、**Playwright**（瀏覽器 E2E，慢）。邏輯寫在 `lib/`，才有辦法用 Vitest 測。

## 測試檔案

| 位置 | 內容 |
| --- | --- |
| `lib/games/precise-stop/__tests__/` | physics、scoring、route、records、session、share-code、card、config、leaderboard、account-sync、sound-mix、view |
| `lib/games/office-escape/__tests__/` | game（模擬、計分、路線、自動駕駛）、records（本機紀錄、帳號紀錄檢查、待上傳、成績代碼、排行榜 SQL、訪客併入） |
| `lib/account/__tests__/` | session、nick、return-path、me-store、guest-merge（用真的 SQL） |
| `lib/catalog/__tests__/catalog.test.ts` | 遊戲目錄 schema 與唯一性 |
| `lib/i18n/__tests__/` | 七種語言字典鍵值一致、語言前綴 |
| `lib/__tests__/site-metadata.test.ts` | canonical、hreflang |
| `server/__tests__/body-limit.test.ts` | 請求大小限制 |
| `scripts/__tests__/site-url.test.ts` | `SITE_URL` 檢查 |
| `tests/e2e/*.spec.ts` | account、game、leaderboard、office-escape、records-sync、site、sound |

Vitest 設定（`vitest.config.mts`）：`environment: node`，收 `**/*.{test,spec}.ts`，排除 `tests/e2e/`、`.nuxt/`、`.output/`、`.wrangler/`、`.scratch/`；`@` 別名指向專案根目錄。

## 指令

| 指令 | 用途 |
| --- | --- |
| `npm test` | 跑全部 Vitest |
| `npx vitest run lib/account/__tests__/nick.test.ts` | 跑單一檔 |
| `npm run test:watch` | 監看模式 |
| `npm run test:e2e` | 全部 Playwright（desktop 與 mobile 兩個 project） |
| `npx playwright test tests/e2e/game.spec.ts --project=desktop` | 單一檔、單一 project |
| `npm run typecheck`、`npm run lint` | 提交前一起跑 |

## 執行順序與依賴

- Vitest 之間互不依賴，可平行。
- E2E 由 `playwright.config.ts` 自動啟動兩個伺服器：假的 Google（`tests/e2e/fake-google.mjs`，port 3999）、以及 `npm run db:migrate:local && npm run dev`（port 3000，並注入 `FEATURE_LOGIN=1`、假的 Google 設定）。
- 自己已經開著 `npm run dev` 時 Playwright 會沿用，**但那台若沒設上述環境變數，登入測試會失敗**。
- `workers: 2`：所有測試共用一台 dev server，再多會因為編譯與遊戲畫面搶 CPU 而偶發逾時。單測逾時 90 秒，CI 重試 2 次。
- E2E 會寫本機 D1（`.wrangler/state`），資料會累積；需要乾淨環境時刪掉該目錄再 `db:migrate:local`。

## 輔助函式

- `lib/__tests__/d1-sqlite.ts` 的 `sqliteD1()`：用 `node:sqlite` 記憶體資料庫套用全部 `migrations/*.sql`（含觸發器），模擬 D1 的 `prepare().bind().all()/first()/run()` 與 `batch`（交易包住，全成功或全失敗）。要測 SQL、觸發器、`ON CONFLICT`、合併邏輯就用它，不要自己 mock。
- `tests/e2e/fixtures.ts`：
  - 匯出擴充過的 `test`／`expect`；`page.goto`／`page.reload` 之後會自動等網站接手完成（`html[data-hydrated]`，見 `app/plugins/hydrated.client.ts`），接手前的點擊不會生效。
  - `waitForHydration(page)`、`randomIp()`（10.x.x.x，用來避開每 IP 限流）。
- `tests/e2e/helpers.ts`：E2E 共用操作。

## 新增單元測試

1. 邏輯放 `lib/<領域>/`，測試放同層 `__tests__/<名稱>.test.ts`。
2. `import { describe, it, expect } from "vitest"`，用 `@/` 引入被測模組。
3. 時間相關函式一律傳入 `now` 參數，不要用真的時鐘；台灣日期用 `taiwanDateKey(now)`。
4. 會碰資料庫的邏輯用 `sqliteD1()`。

```ts
import { describe, expect, it } from "vitest";
import { renewedExpiry } from "@/lib/account/session";

describe("renewedExpiry", () => {
  it("剩不到 200 天才延長", () => {
    const now = new Date("2026-11-22T00:00:00Z");
    expect(renewedExpiry(new Date("2027-01-01T00:00:00Z"), now)).not.toBeNull();
    expect(renewedExpiry(new Date("2027-12-01T00:00:00Z"), now)).toBeNull();
  });
});
```

## 新增 E2E 測試

1. 從 `./fixtures` 匯入 `test`、`expect`，不要直接用 `@playwright/test` 的（才會等接手）。
2. 每個測試用 `randomIp()` 設定請求 IP，避免撞到訪客建立限流。
3. 登入流程連到假的 Google，不要連真的。
4. 對應驗收標準時，測試名稱帶上條目編號（例如 `T11`）。

## 常見陷阱

- 沒等接手就點擊：頁面看起來好了但事件還沒綁，測試偶發失敗。
- 只開 `npm run dev` 沒帶 E2E 環境變數就跑登入測試。
- WSL 掛載的 Windows 磁碟上 dev server 不偵測檔案變更：改完程式要重啟，否則測到舊版本。
- 排行榜邊緣快取只在 Workers 上有，本機測不到 `hit`；測快取行為要用 `npm run preview` 以外的方式（待確認）。
- 手動改過 `migrations/` 已存在的檔案，會讓 `sqliteD1()` 與本機 D1 的結構不同步。
- 觸發器與批次的行為要用 `sqliteD1()` 驗證，不要只測 Prisma 呼叫的回傳值。
