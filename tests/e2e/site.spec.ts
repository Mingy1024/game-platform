import { expect, test } from "./fixtures";
import { GAME, watchConsole } from "./helpers";

const LOCALES = [
  { prefix: "", lang: "zh-Hant-TW" },
  { prefix: "/zh-cn", lang: "zh-Hans-CN" },
  { prefix: "/en", lang: "en" },
  { prefix: "/ja", lang: "ja" },
  { prefix: "/ko", lang: "ko" },
  { prefix: "/vi", lang: "vi" },
  { prefix: "/pt", lang: "pt-BR" },
];

test("A1 舊遊戲的網址回傳 404", async ({ request }) => {
  for (const slug of ["tap-targets", "lane-dodge", "memory-pairs"]) {
    expect((await request.get(`/games/${slug}`)).status(), slug).toBe(404);
  }
  expect((await request.get("/games/tap-targets/0.1.0/cover.svg")).status()).toBe(404);
});

test("A3 首頁、全部遊戲、分類頁、熱門榜都連得到精準停車，圖片沒有壞掉", async ({ page }) => {
  const problems = watchConsole(page);
  for (const path of ["/", "/games", "/categories/reflex", "/categories/casual", "/hot"]) {
    await page.goto(path);
    await expect(page.locator(`main a[href="${GAME}"]`).first(), path).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const broken = await page.evaluate(async () => {
      const images = [...document.images];
      await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
      return images.filter((image) => image.naturalWidth === 0).map((image) => image.src);
    });
    expect(broken, path).toEqual([]);
  }
  expect(problems).toEqual([]);
});

test("A3 首頁主推區有遊戲預覽圖", async ({ page }) => {
  await page.goto("/");
  const preview = page.locator('section[aria-labelledby="featured-title"] img');
  await expect(preview).toBeVisible();
  const box = await preview.boundingBox();
  expect(box!.width).toBeGreaterThan(200);
  expect(box!.height).toBeGreaterThan(200);
  expect(await preview.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
});

test("I1 首頁的預覽圖、開始鈕、遊戲卡都先進介紹頁，不會直接開始", async ({ page }) => {
  const featured = 'section[aria-labelledby="featured-title"]';
  const entries = [
    `${featured} a[aria-hidden="true"]`,
    `${featured} a[href="${GAME}"]:not([aria-hidden])`,
    `main a[href="${GAME}"]:not(${featured} a)`,
  ];
  for (const entry of entries) {
    await page.goto("/");
    await page.locator(entry).first().click();
    // 開發伺服器在完整套件同時跑遊戲時，第一次編譯介紹頁可能超過預設的 5 秒
    await expect(page, entry).toHaveURL(GAME, { timeout: 15_000 });
    await expect(page.getByTestId("departure-board")).toBeVisible();
    await expect(page.getByTestId("game-stage")).toHaveCount(0);
  }
});

test("K1 K4 七種語言都有網址，lang、標題、描述、hreflang 正確", async ({ page }) => {
  const titles = new Set<string>();
  for (const { prefix, lang } of LOCALES) {
    for (const path of [prefix || "/", `${prefix}${GAME}`]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      await expect(page.locator("html"), path).toHaveAttribute("lang", lang);
      const title = await page.title();
      expect(title.length, path).toBeGreaterThan(0);
      titles.add(`${path}|${title}`);
      const description = await page.locator('meta[name="description"]').getAttribute("content");
      expect(description?.length ?? 0, path).toBeGreaterThan(20);
      const alternates = await page
        .locator('link[rel="alternate"][hreflang]')
        .evaluateAll((links) => links.map((link) => link.getAttribute("hreflang")));
      for (const expected of [...LOCALES.map((locale) => locale.lang), "x-default"]) {
        expect(alternates, `${path} hreflang ${expected}`).toContain(expected);
      }
    }
  }
  // 各語言的遊戲頁標題不一樣（確實有翻譯）
  const gameTitles = [...titles].filter((entry) => entry.includes(GAME)).map((entry) => entry.split("|")[1]);
  expect(new Set(gameTitles).size).toBe(LOCALES.length);
  expect((await page.request.get("/xx")).status()).toBe(404);
  expect((await page.request.get("/en/hot")).status()).toBe(404);
});

test("K2 語言選單只用各語言自己的寫法，切換後留在同一頁", async ({ page }) => {
  for (const start of ["/", GAME]) {
    await page.goto(start);
    // 換語言會換掉根版面，開發版的新舊頁首可能短暫同時存在，等只剩一個再點
    await expect(page.getByTestId("language-button")).toHaveCount(1);
    await page.getByTestId("language-button").click();
    const menu = page.getByRole("dialog");
    await expect(menu).toBeVisible();
    const options = await menu.getByRole("link").allInnerTexts();
    expect(options.map((option) => option.trim())).toEqual([
      "繁體中文",
      "简体中文",
      "English",
      "日本語",
      "한국어",
      "Tiếng Việt",
      "Português",
    ]);
    await menu.getByRole("link", { name: "日本語" }).click();
    await expect(page).toHaveURL(start === "/" ? "/ja" : `/ja${GAME}`);
    await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  }
});

test.describe("K3 不看瀏覽器語言", () => {
  test.use({ locale: "ja-JP" });
  test("瀏覽器是日文也顯示繁體中文；選過的語言會記住", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hant-TW");
    await page.getByTestId("language-button").click();
    await page.getByRole("dialog").getByRole("link", { name: "English" }).click();
    await expect(page).toHaveURL("/en");
    await page.goto("/");
    await expect(page).toHaveURL("/en");
    // 站內換頁回首頁（只有繁中的全部遊戲頁 → 頁首站名）也沿用選過的語言
    await page.goto("/games");
    await page.locator("header a").first().click();
    await expect(page).toHaveURL("/en");
  });
});

test("L1 廣告只有一個版位，在怎麼玩和判定與計分之間，沒有載入廣告程式", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto(GAME);
  const order = await page.evaluate(() => {
    const top = (selector: string) => document.querySelector(selector)!.getBoundingClientRect().top;
    return {
      count: document.querySelectorAll("[data-ad-slot]").length,
      howto: top("#howto-title"),
      ad: top("[data-ad-slot]"),
      scoring: top("#scoring-title"),
    };
  });
  expect(order.count).toBe(1);
  expect(order.howto).toBeLessThan(order.ad);
  expect(order.ad).toBeLessThan(order.scoring);
  const external = requests.filter((url) => !url.startsWith("http://localhost:3000") && !url.startsWith("data:"));
  expect(external).toEqual([]);
});

// 登入已經做好，改由環境變數 NEXT_PUBLIC_FEATURE_LOGIN 控制，測試在 tests/e2e/account.spec.ts
test("L2 預留功能預設關閉：沒有排行榜、累計發車次數", async ({ page }) => {
  await page.goto(GAME);
  await expect(page.getByTestId("records-card")).toBeVisible();
  for (const id of ["rank-tab", "leaderboard", "play-count"]) {
    await expect(page.getByTestId(id), id).toHaveCount(0);
  }
});

test("L3 開關打開時版位會出現", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("game-station:flags", "leaderboard,playCount");
  });
  await page.goto(GAME);
  await expect(page.getByTestId("rank-tab")).toBeVisible();
  await expect(page.getByTestId("play-count")).toBeVisible();
  await page.getByTestId("rank-tab").click();
  await expect(page.getByTestId("leaderboard")).toBeVisible();
});

test("N1 各種寬度都沒有橫向捲軸", async ({ page }) => {
  for (const width of [360, 390, 1280, 1920]) {
    await page.setViewportSize({ width, height: 800 });
    for (const path of ["/", GAME, `/pt${GAME}`, `/vi${GAME}`, "/ko"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} @${width}`).toBeLessThanOrEqual(0);
    }
  }
});

test("N2 N3 介紹頁可以點的東西至少 44 px，按鈕和連結都有名稱", async ({ page }) => {
  await page.goto(GAME);
  const report = await page.evaluate(() => {
    const small: string[] = [];
    const unnamed: string[] = [];
    for (const element of document.querySelectorAll<HTMLElement>("button, a[href]")) {
      const box = element.getBoundingClientRect();
      // 1 px 的是只給鍵盤用的「跳到主要內容」，取得焦點才會展開
      if (box.width <= 1 || box.height <= 1) continue;
      const name = (element.getAttribute("aria-label") ?? element.innerText ?? "").trim();
      if (!name) unnamed.push(element.outerHTML.slice(0, 120));
      // 段落裡的文字連結不算（WCAG 2.5.8 的行內例外）
      const inline = getComputedStyle(element).display === "inline";
      if (!inline && (box.width < 44 || box.height < 44)) {
        small.push(`${name} ${Math.round(box.width)}×${Math.round(box.height)}`);
      }
    }
    return { small, unnamed };
  });
  expect(report.unnamed).toEqual([]);
  expect(report.small).toEqual([]);
});
