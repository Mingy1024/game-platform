import { test as base, type BrowserContext, type Page } from "@playwright/test";

export { expect } from "@playwright/test";
export type { Browser, BrowserContext, Page } from "@playwright/test";

/** 等網站在瀏覽器端接手完成（app/plugins/hydrated.client.ts）；接手前的點擊不會生效 */
export const waitForHydration = (page: Page) =>
  page.waitForSelector("html[data-hydrated]", { state: "attached", timeout: 30_000 }).then(() => undefined);

/** 測試用的隨機 IP（10.x.x.x） */
export const randomIp = () => `10.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${1 + Math.floor(Math.random() * 254)}`;

/**
 * 和 @playwright/test 一樣，只是 page.goto／page.reload 之後會等網站接手完成。
 * 對 API、圖片這類非 HTML 的網址不等。
 */
/** page.goto／page.reload 之後等網站接手 */
function wrapPage(page: Page) {
  const wrap = <A extends unknown[]>(original: (...args: A) => ReturnType<Page["goto"]>) =>
    async (...args: A) => {
      const response = await original(...args);
      if (response?.headers()["content-type"]?.includes("text/html")) await waitForHydration(page);
      return response;
    };
  page.goto = wrap(page.goto.bind(page));
  page.reload = wrap(page.reload.bind(page));
  return page;
}

/** 自己開的 context 裡的新分頁，和測試的 page 一樣會等接手 */
export const hydratedPage = async (context: BrowserContext) => wrapPage(await context.newPage());

export const test = base.extend({
  // 每個測試用不同的 IP（開發環境的 cf-connecting-ip 由請求決定）：建立排行榜訪客的限流是同一個 IP 每分鐘 3 個（T10），
  // 不分開的話，所有測試玩完一局時都會搶同一個額度
  // eslint-disable-next-line no-empty-pattern -- Playwright 的 fixture 第一個參數一定要用解構
  extraHTTPHeaders: async ({}, use) => {
    await use({ "cf-connecting-ip": randomIp() });
  },
  page: async ({ page }, use) => {
    await use(wrapPage(page));
  },
});
