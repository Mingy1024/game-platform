import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  // 所有測試共用一台開發伺服器，平行太多時編譯和遊戲畫面會搶 CPU、造成偶發逾時；2 個實測最穩也最快
  workers: 2,
  timeout: 90_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      // 假的 Google 登入端點（tests/e2e/fake-google.mjs）
      command: "node tests/e2e/fake-google.mjs",
      url: "http://localhost:3999/health",
      reuseExistingServer: !process.env.CI,
    },
    {
      // 先把 migrations 套到本機 D1，再開開發伺服器（nuxt dev）；登入改連假的 Google
      command: "npm run db:migrate:local && npm run dev",
      url: "http://localhost:3000",
      // 自己已經開著 npm run dev 時會直接沿用；那台沒設下面的環境變數的話，登入測試（account.spec.ts）會失敗
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      env: {
        FEATURE_LOGIN: "1",
        // 累計遊玩次數的 API 與回報（tests/e2e/play-count.spec.ts）；次數未滿 100 不顯示，其他測試的畫面不受影響
        FEATURE_PLAY_COUNT: "1",
        GOOGLE_OAUTH_TEST_BASE_URL: "http://localhost:3999",
        GOOGLE_CLIENT_ID: "e2e-client.apps.googleusercontent.com",
        GOOGLE_CLIENT_SECRET: "e2e-secret",
      },
    },
  ],
});
