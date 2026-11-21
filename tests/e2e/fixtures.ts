import { test as base, type Page } from "@playwright/test";

export { expect } from "@playwright/test";
export type { BrowserContext, Page } from "@playwright/test";

/** 等網站在瀏覽器端接手完成（app/plugins/hydrated.client.ts）；接手前的點擊不會生效 */
export const waitForHydration = (page: Page) =>
  page.waitForSelector("html[data-hydrated]", { state: "attached", timeout: 30_000 }).then(() => undefined);

/**
 * 和 @playwright/test 一樣，只是 page.goto／page.reload 之後會等網站接手完成。
 * 對 API、圖片這類非 HTML 的網址不等。
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    const wrap = <A extends unknown[]>(original: (...args: A) => ReturnType<Page["goto"]>) =>
      async (...args: A) => {
        const response = await original(...args);
        if (response?.headers()["content-type"]?.includes("text/html")) await waitForHydration(page);
        return response;
      };
    page.goto = wrap(page.goto.bind(page));
    page.reload = wrap(page.reload.bind(page));
    await use(page);
  },
});
