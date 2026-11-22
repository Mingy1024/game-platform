---
paths:
  - "**/__tests__/**"
  - "**/*.test.ts"
  - "tests/e2e/**"
  - "vitest.config.mts"
  - "playwright.config.ts"
---

# 測試規則

- 單元測試用 Vitest（`environment: node`），放在被測模組同層的 `__tests__/<名稱>.test.ts`，用 `@/` 引入。
- 邏輯放 `lib/` 才好測；時間相關函式傳入 `now`，不依賴真的時鐘，「日」用 `taiwanDateKey`。
- 測 SQL、觸發器、`ON CONFLICT`、合併邏輯用 `lib/__tests__/d1-sqlite.ts` 的 `sqliteD1()`（套用全部 migrations），不要 mock 資料庫。
- E2E 用 Playwright，`test`／`expect` 從 `tests/e2e/fixtures.ts` 匯入（`goto`／`reload` 之後會等 `html[data-hydrated]`）；每個測試用 `randomIp()` 避開每 IP 限流；登入連假的 Google（`fake-google.mjs`），不連真的。
- 驗收標準有編號的條目（`docs/acceptance/precise-stop.md`），測試名稱帶編號，方便對照。
- 修 bug 先寫會失敗的測試，再修。
- 不為了讓測試通過而放寬判斷、刪測試或加 `.skip`；測試失敗要先搞清楚是程式還是測試的問題。
- E2E 只在動到畫面、登入流程或同步時跑；平常跑 `npm test`、`npm run typecheck`、`npm run lint`。
- 要重啟 dev server 才會吃到最新程式（WSL 掛載的磁碟不偵測檔案變更）。
