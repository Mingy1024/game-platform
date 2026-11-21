import { expect, test, type BrowserContext, type Page } from "./fixtures";
import { GAME } from "./helpers";

/**
 * 帳號與登入（設計稿：帳號與登入設計稿）。Google 由 tests/e2e/fake-google.mjs 假扮，
 * 在 localhost 設 fake_sub cookie 決定登入成哪個 Google 帳號、fake_deny=1 模擬按取消。
 * 每個測試用不同的 Google 帳號，平行跑也不會互相影響。
 */

const unique = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

async function asGoogleUser(context: BrowserContext, sub = `e2e-${unique()}`) {
  await context.addCookies([{ name: "fake_sub", value: sub, domain: "localhost", path: "/" }]);
  return sub;
}

async function login(page: Page, path = GAME) {
  await page.goto(path);
  await page.getByTestId("login-button").first().click();
  await expect(page.getByTestId("banner-ok")).toBeVisible();
}

test.describe("帳號與登入", () => {
  test("A1 未登入：紀錄卡有登入按鈕和隱私說明，頁首沒有登入", async ({ page }) => {
    await page.goto(GAME);
    const hint = page.getByTestId("login-hint");
    await expect(hint.getByTestId("login-button")).toBeVisible();
    await expect(hint).toContainText("不存名字和信箱");
    await expect(page.locator("header").getByTestId("login-button")).toHaveCount(0);
  });

  test("A2 登入後回到原本的頁面，提示條顯示暱稱，網址上的參數會拿掉", async ({ page, context }) => {
    await asGoogleUser(context);
    await login(page);
    await expect(page).toHaveURL(new RegExp(`${GAME}$`));
    await expect(page.getByTestId("banner-ok")).toContainText("你在榜上叫");
    const card = page.getByTestId("records-logged-in");
    await expect(card).toContainText("已用 Google 登入");
    await expect(card.getByTestId("nick-name")).toHaveText(/\S+ \d{4}$/);

    // 重新整理後提示條不再出現，但還是登入狀態
    await page.reload();
    await expect(page.getByTestId("records-logged-in")).toBeVisible();
    await expect(page.getByTestId("banner-ok")).toHaveCount(0);
  });

  test("A3 其他語言的頁面登入後也回到原頁，暱稱用該語言顯示", async ({ page, context }) => {
    await asGoogleUser(context);
    await login(page, `/en${GAME}`);
    await expect(page).toHaveURL(new RegExp(`/en${GAME}$`));
    await expect(page.getByTestId("banner-ok")).toContainText("Signed in");
    await expect(page.getByTestId("records-logged-in")).toContainText("Signed in with Google");
  });

  test("A4 在 Google 按取消：顯示失敗提示，要按關閉才會消失", async ({ page, context }) => {
    await context.addCookies([{ name: "fake_deny", value: "1", domain: "localhost", path: "/" }]);
    await page.goto(GAME);
    await page.getByTestId("login-button").first().click();
    const banner = page.getByTestId("banner-error");
    await expect(banner).toContainText("登入沒有完成");
    await expect(banner.getByRole("link", { name: "再試一次" })).toBeVisible();
    await page.waitForTimeout(5500);
    await expect(banner).toBeVisible();
    await banner.getByRole("button", { name: "關閉" }).click();
    await expect(banner).toHaveCount(0);
    await expect(page.getByTestId("login-hint")).toBeVisible();
  });

  test("A5 改暱稱：打字時檢查字元，儲存後進入 7 天冷卻，改回隨機名字不受限制", async ({ page, context }) => {
    await asGoogleUser(context);
    await login(page, "/me");
    await page.goto("/me/settings");
    const form = page.getByTestId("nick-form");
    const input = form.getByLabel("暱稱");

    await input.fill("阿明!!");
    await expect(form.getByTestId("nick-error")).toContainText("有不能用的字");
    await expect(form.getByRole("button", { name: "儲存" })).toBeDisabled();

    const name = `明${unique().slice(-6)}`;
    await input.fill(name);
    await form.getByRole("button", { name: "儲存" }).click();
    await expect(form.getByTestId("nick-saved")).toBeVisible();
    await expect(form.getByTestId("nick-next")).toContainText("下次可以改");
    await expect(input).toBeDisabled();

    await form.getByRole("button", { name: "改回隨機名字" }).click();
    await expect(page.getByTestId("nick-form").getByRole("button", { name: "改回隨機名字" })).toHaveCount(0);

    await page.goto("/me");
    await expect(page.getByTestId("me-account").getByTestId("nick-name")).toHaveText(/\S+ \d{4}$/);
  });

  test("A6 別人用過的名字不能用", async ({ browser }) => {
    const name = `站${unique().slice(-6)}`;
    for (const [index, expected] of [
      [0, "nick-saved"],
      [1, "nick-error"],
    ] as const) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await asGoogleUser(context);
      await login(page, "/me");
      await page.goto("/me/settings");
      const form = page.getByTestId("nick-form");
      // 第二個人輸入大小寫、空白不同的同一個名字也算重複
      await form.getByLabel("暱稱").fill(index === 0 ? name : ` ${name.toUpperCase()} `);
      await form.getByRole("button", { name: "儲存" }).click();
      await expect(form.getByTestId(expected)).toBeVisible();
      if (expected === "nick-error") await expect(form.getByTestId("nick-error")).toHaveText("這個名字有人用了");
      await context.close();
    }
  });

  test("A7 登出：留在我的紀錄頁，帳號卡換回還沒登入", async ({ page, context }) => {
    await asGoogleUser(context);
    await login(page, "/me");
    await page.getByRole("button", { name: "登出" }).click();
    await expect(page.getByTestId("banner-info")).toHaveText(/已經登出了/);
    await expect(page.getByTestId("me-account")).toContainText("還沒登入");
    await page.reload();
    await expect(page.getByTestId("me-account")).toContainText("還沒登入");
  });

  test("A8 刪除帳號：焦點先在取消，確定後刪除；再登入是全新的帳號", async ({ page, context }) => {
    const sub = await asGoogleUser(context);
    await login(page, "/me/settings");
    const name = `刪${unique().slice(-6)}`;
    await page.getByTestId("nick-form").getByLabel("暱稱").fill(name);
    await page.getByRole("button", { name: "儲存" }).click();
    await expect(page.getByTestId("nick-saved")).toBeVisible();

    await page.goto("/me");
    await page.getByRole("button", { name: "刪除帳號" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText(name);
    await expect(dialog.getByRole("button", { name: "取消" })).toBeFocused();
    await dialog.getByRole("button", { name: "確定刪除" }).click();
    await expect(page.getByTestId("banner-info")).toHaveText(/已經刪除了/);
    await expect(page.getByTestId("me-account")).toContainText("還沒登入");

    // 同一個 Google 帳號再登入：新帳號、隨機暱稱，原本的自訂暱稱也釋出了
    await asGoogleUser(context, sub);
    await login(page, "/me");
    await expect(page.getByTestId("me-account").getByTestId("nick-name")).toHaveText(/\S+ \d{4}$/);
  });

  test("A9 帳號設定頁未登入時只有登入按鈕", async ({ page }) => {
    await page.goto("/me/settings");
    await expect(page.getByTestId("settings-logged-out")).toContainText("用 Google 登入才能自訂暱稱");
    await expect(page.getByTestId("nick-form")).toHaveCount(0);
  });

  test("A10 return 只接受站內路徑", async ({ page, context }) => {
    await asGoogleUser(context);
    await page.goto("/api/auth/google/start?return=//evil.example/");
    await expect(page).toHaveURL("http://localhost:3000/");
  });

  test("A11 會改資料的 API 擋跨站請求", async ({ request }) => {
    const response = await request.post("/api/auth/logout", { headers: { Origin: "https://evil.example" } });
    expect(response.status()).toBe(403);
    const nick = await request.patch("/api/me/nick", {
      headers: { Origin: "http://localhost:3000" },
      data: { custom: "阿明" },
    });
    expect(nick.status()).toBe(401);
  });
});

test.describe("App 內建瀏覽器", () => {
  test.use({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0",
  });

  test("B1 Instagram 裡顯示用瀏覽器打開的提示，沒有登入按鈕", async ({ page }) => {
    await page.goto(GAME);
    const notice = page.getByTestId("in-app-notice");
    await expect(notice).toContainText("在 App 裡不能用 Google 登入");
    await expect(notice.getByRole("button", { name: "複製連結" })).toBeVisible();
    await expect(page.getByTestId("login-button")).toHaveCount(0);
  });
});

test.describe("Android 版 LINE", () => {
  test.use({
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 Line/14.0.0",
  });

  test("B2 登入按鈕換成用外部瀏覽器打開", async ({ page }) => {
    await page.goto(GAME);
    const button = page.getByTestId("login-button");
    await expect(button).toHaveText("用瀏覽器開啟");
    await expect(button).toHaveAttribute("href", /openExternalBrowser=1/);
  });
});
