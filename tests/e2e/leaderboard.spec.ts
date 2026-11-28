import { expect, hydratedPage, randomIp, test, type Browser, type BrowserContext, type Page } from "./fixtures";
import { enterGame, GAME, playToFinal } from "./helpers";

/**
 * 精準停車的全站排行與訪客（驗收清單 T 組，設計稿第 14 節）。
 * 開發環境用標頭模擬 Cloudflare：cf-connecting-ip（建立訪客的 IP 限流）、cf-ipcountry（歐盟地區）。
 * 本機 D1 是所有測試共用的，榜上會有其他測試的成績：斷言只比較這個測試自己建立的玩家。
 */
const RECORDS = "/api/games/precise-stop/records";
const LB = "/api/games/precise-stop/leaderboard";
const ORIGIN = "http://localhost:3000";
const LOCAL = "game-station:precise-stop:v1";

const unique = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const today = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
const run = (score: number, dateKey: string | null = today()) => ({
  mode: dateKey ? "daily" : "free",
  dateKey,
  score,
  achievedAt: Date.now() - 1000,
});

type Bests = ReturnType<typeof run>[];

/** 新的瀏覽器（自己的 cookie 和 IP） */
const newBrowser = (browser: Browser, headers: Record<string, string> = {}) =>
  browser.newContext({ extraHTTPHeaders: { "cf-connecting-ip": randomIp(), ...headers } });

/** 用 API 建立訪客：沒有身分時 playerId 送 null */
async function postAsNew(context: BrowserContext | Page, bests: Bests, perfectDelta = 0, extra: Record<string, unknown> = {}) {
  const syncId = `id-${unique()}`;
  const response = await context.request.post(`${RECORDS}/sync`, {
    headers: { Origin: ORIGIN },
    data: { syncId, playerId: null, bests, perfectDelta, ...extra },
  });
  return { response, syncId, body: (await response.json().catch(() => null)) as { guest?: { playerId: string }; error?: string } | null };
}

const mine = async (context: BrowserContext | Page, scope: string, player: string) =>
  (await context.request.get(`${LB}/me?scope=${scope}&player=${player}`)).json() as Promise<{
    rank: number | null;
    score: number | null;
    total: number;
    toTop100: number | null;
  }>;

const me = async (context: BrowserContext | Page) =>
  (await context.request.get("/api/me")).json() as Promise<{ loggedIn: boolean; guest?: { playerId: string } | null; consentRequired?: boolean }>;

async function guestCookie(context: BrowserContext) {
  return (await context.cookies()).find((cookie) => cookie.name === "gs_guest");
}

async function login(page: Page, context: BrowserContext, path = GAME) {
  await context.addCookies([{ name: "fake_sub", value: `e2e-lb-${unique()}`, domain: "localhost", path: "/" }]);
  await page.goto(path);
  await page.getByTestId("login-button").first().click();
  await expect(page.getByTestId("banner-ok")).toBeVisible();
}

const openRank = async (page: Page) => {
  await page.getByTestId("rank-tab").click();
  await expect(page.getByTestId("leaderboard")).toBeVisible();
};

test.describe("排行榜 API", () => {
  test("T1 T2 T5 T8 T18 建立訪客上榜；排序、每人一次、不帶個人資料、名次不快取", async ({ browser }) => {
    const [a, b, c] = await Promise.all([newBrowser(browser), newBrowser(browser), newBrowser(browser)]);
    const first = await postAsNew(a, [run(5999), run(4321, null)], 2);
    expect(first.response.status()).toBe(200);
    const idA = first.body!.guest!.playerId;
    const idB = (await postAsNew(b, [run(5999)])).body!.guest!.playerId;
    const idC = (await postAsNew(c, [run(5998)])).body!.guest!.playerId;

    // T8 cookie：HttpOnly、SameSite=Lax、約 400 天（Secure 只在 https 加，和 gs_session 相同）
    const cookie = (await guestCookie(a))!;
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax" });
    expect(cookie.expires * 1000 - Date.now()).toBeGreaterThan(399 * 86_400_000);
    expect(await me(a)).toMatchObject({ loggedIn: false, guest: { playerId: idA } });

    // T2 同分時先創下的在前；分數低的在後
    const [ra, rb, rc] = await Promise.all([mine(a, "daily", idA), mine(b, "daily", idB), mine(c, "daily", idC)]);
    expect(ra.rank! < rb.rank!).toBe(true);
    expect(rb.rank! < rc.rank!).toBe(true);

    // T1 T5 前 100 名：自己那一列在對的位置、標示訪客、不帶任何玩家 ID；不快取在瀏覽器
    const topResponse = await a.request.get(`${LB}?scope=daily`);
    expect(topResponse.headers()["cache-control"]).toBe("no-cache");
    expect(topResponse.headers()["x-leaderboard-cache"]).toMatch(/hit|miss/);
    const top = await topResponse.json();
    expect(top).toMatchObject({ scope: "daily", period: today() });
    expect(top.rows[ra.rank! - 1]).toMatchObject({ rank: ra.rank, score: 5999, guest: true });
    const text = JSON.stringify(top);
    for (const id of [idA, idB, idC]) expect(text).not.toContain(id);
    expect(Object.keys(top.rows[0]).sort()).toEqual(["achievedAt", "color", "guest", "nick", "rank", "score"]);

    // 本週、自由模式
    expect((await mine(a, "week", idA)).score).toBe(5999);
    expect((await mine(a, "free", idA)).score).toBe(4321);
    expect(await mine(b, "free", idB)).toMatchObject({ rank: null, score: null });

    // 同一天再送一個比較低的分數：不覆蓋（每人只出現一次由主鍵保證，單元測試 T1 T2 用 SQL 檢查）
    const again = await a.request.post(`${RECORDS}/sync`, {
      headers: { Origin: ORIGIN },
      data: { syncId: `id-${unique()}`, playerId: idA, bests: [run(3000)], perfectDelta: 0 },
    });
    expect(again.status()).toBe(200);
    expect((await mine(a, "daily", idA)).score).toBe(5999);

    // 自己的名次每次現算、不快取
    const mineResponse = await a.request.get(`${LB}/me?scope=daily&player=${idA}`);
    expect(mineResponse.headers()["cache-control"]).toBe("no-store");

    // T18 只檢查分數範圍
    expect((await postAsNew(a, [run(6001)])).response.status()).toBe(400);
    await Promise.all([a.close(), b.close(), c.close()]);
  });

  test("T9 建立的回應掉了：同一個 syncId 重送找回同一個訪客、補發 cookie；同時送兩次也只建立一個", async ({ browser }) => {
    const a = await newBrowser(browser);
    const syncId = `id-${unique()}`;
    const send = () =>
      a.request.post(`${RECORDS}/sync`, { headers: { Origin: ORIGIN }, data: { syncId, playerId: null, bests: [run(2500)], perfectDelta: 3 } });
    const first = await (await send()).json();
    await a.clearCookies();
    const retry = await send();
    expect(retry.status()).toBe(200);
    const body = await retry.json();
    expect(body.guest.playerId).toBe(first.guest.playerId);
    expect(body.perfectStops).toBe(3);
    expect(await guestCookie(a)).toBeDefined();
    expect((await me(a)).guest?.playerId).toBe(first.guest.playerId);

    // 兩個分頁（沒有 Web Locks 時）同時送同一批
    const b = await newBrowser(browser);
    const together = `id-${unique()}`;
    const post = () =>
      b.request.post(`${RECORDS}/sync`, { headers: { Origin: ORIGIN }, data: { syncId: together, playerId: null, bests: [], perfectDelta: 1 } });
    const [x, y] = await Promise.all([post(), post()]);
    const [bx, by] = [await x.json(), await y.json()];
    expect(bx.guest.playerId).toBe(by.guest.playerId);
    expect(Math.max(bx.perfectStops, by.perfectStops)).toBe(1);
    await Promise.all([a.close(), b.close()]);
  });

  test("T10 同一個 IP 每分鐘最多建立 3 個訪客，超過回 429", async ({ browser }) => {
    const ip = randomIp();
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      const context = await newBrowser(browser, { "cf-connecting-ip": ip });
      statuses.push((await postAsNew(context, [run(1000)])).response.status());
      await context.close();
    }
    expect(statuses).toEqual([200, 200, 200, 429]);
  });

  test("T11 T24 歐盟地區沒帶同意回 403；刪除訪客擋跨站；名次的身分不符回 409", async ({ browser }) => {
    const eu = await newBrowser(browser, { "cf-ipcountry": "DE" });
    expect(await me(eu)).toMatchObject({ loggedIn: false, guest: null, consentRequired: true });
    const denied = await postAsNew(eu, [run(1000)]);
    expect(denied.response.status()).toBe(403);
    expect(denied.body).toEqual({ error: "consent_required" });
    expect(await guestCookie(eu)).toBeUndefined();
    const allowed = await postAsNew(eu, [run(1000)], 0, { consent: true });
    expect(allowed.response.status()).toBe(200);
    const id = allowed.body!.guest!.playerId;

    expect((await eu.request.delete("/api/guest", { headers: { Origin: "https://evil.example" } })).status()).toBe(403);
    expect((await eu.request.delete("/api/guest?player=someone-else", { headers: { Origin: ORIGIN } })).status()).toBe(409);
    expect((await eu.request.get(`${LB}/me?scope=daily&player=someone-else`)).status()).toBe(409);
    expect((await me(eu)).guest?.playerId).toBe(id);
    expect((await eu.request.delete(`/api/guest?player=${id}`, { headers: { Origin: ORIGIN } })).status()).toBe(200);
    expect(await me(eu)).toMatchObject({ guest: null });
    expect((await eu.request.get(`${LB}/me?scope=daily`)).status()).toBe(401);
    await eu.close();
  });

  test("T13 訪客登入 Google：最佳取高分、完美次數相加，訪客刪掉、cookie 清掉", async ({ page, context }) => {
    await login(page, context, "/me");
    const account = (await me(page)) as unknown as { playerId: string };
    await page.request.post(`${RECORDS}/sync`, {
      headers: { Origin: ORIGIN },
      data: { syncId: `id-${unique()}`, playerId: account.playerId, bests: [run(5000, null), run(2000)], perfectDelta: 2 },
    });
    expect((await page.request.post("/api/auth/logout", { headers: { Origin: ORIGIN } })).status()).toBe(200);

    const guest = await postAsNew(page, [run(4000), run(4500, null)], 3);
    const guestId = guest.body!.guest!.playerId;
    await page.goto("/me");
    await page.getByTestId("login-button").first().click();
    await expect(page.getByTestId("banner-ok")).toBeVisible();
    expect(await guestCookie(context)).toBeUndefined();
    const merged = await (await page.request.get(RECORDS)).json();
    expect(merged).toMatchObject({ free: 5000, perfectStops: 5 });
    expect(merged.daily[today()]).toBe(4000);
    // 訪客已經不在：目前的身分是 Google 帳號，用訪客的 ID 讀名次是 409
    expect((await page.request.get(`${LB}/me?scope=daily&player=${guestId}`)).status()).toBe(409);
  });
});

test("T13 T24 登入時沒併成功：GET /api/me 不改資料，前端改用同源 POST 併", async ({ page, context, browser }) => {
  const other = await newBrowser(browser);
  const guestId = (await postAsNew(other, [run(4100)], 2)).body!.guest!.playerId;
  const cookie = (await guestCookie(other))!;
  await login(page, context, "/me");
  // 模擬登入回來時沒併成功：這個瀏覽器還帶著訪客 cookie
  await context.addCookies([{ ...cookie }]);

  const meBody = await (await page.request.get("/api/me")).json();
  expect(meBody).toMatchObject({ loggedIn: true, guestPending: true });
  // 讀取不會併：訪客還在
  expect((await other.request.get(`${LB}/me?scope=daily&player=${guestId}`)).status()).toBe(200);
  expect((await page.request.post("/api/me/guest-merge", { headers: { Origin: "https://evil.example" } })).status()).toBe(403);

  await page.goto("/me");
  await expect.poll(async () => (await (await page.request.get(RECORDS)).json()).daily[today()] ?? null).toBe(4100);
  expect((await (await page.request.get(RECORDS)).json()).perfectStops).toBe(2);
  expect(await guestCookie(context)).toBeUndefined();
  expect((await other.request.get(`${LB}/me?scope=daily&player=${guestId}`)).status()).toBe(401);
  await other.close();
});

test("sync-hardening #3 帶著 Google 與訪客 cookie 送出不合格的同步（400、409）：訪客不會先被併進帳號", async ({ page, context, browser }) => {
  const other = await newBrowser(browser);
  const guestId = (await postAsNew(other, [run(4200)], 1)).body!.guest!.playerId;
  const cookie = (await guestCookie(other))!;
  await login(page, context, "/me");
  const account = ((await (await page.request.get("/api/me")).json()) as { playerId: string }).playerId;
  await context.addCookies([{ ...cookie }]);
  const post = (data: unknown) => page.request.post(`${RECORDS}/sync`, { headers: { Origin: ORIGIN }, data });
  // 格式不對：400，訪客還在、cookie 還在
  expect((await post({ syncId: `id-${unique()}`, playerId: account, bests: "bad", perfectDelta: 0 })).status()).toBe(400);
  // playerId 不是目前的帳號：409，訪客還在
  expect((await post({ syncId: `id-${unique()}`, playerId: "someone-else", bests: [], perfectDelta: 0 })).status()).toBe(409);
  expect((await other.request.get(`${LB}/me?scope=daily&player=${guestId}`)).status()).toBe(200);
  expect(await guestCookie(context)).toBeDefined();
  // 合格的請求才併
  expect((await post({ syncId: `id-${unique()}`, playerId: account, bests: [], perfectDelta: 0 })).status()).toBe(200);
  expect(await guestCookie(context)).toBeUndefined();
  expect((await other.request.get(`${LB}/me?scope=daily&player=${guestId}`)).status()).toBe(401);
  await other.close();
});

test.describe("排行榜畫面", () => {
  test("T8 T12 T17 沒登入玩完一局：自動建立訪客上榜；榜上、你的名次、/me 都有訪客標籤；不能改暱稱", async ({ page, context }) => {
    await enterGame(page);
    await playToFinal(page);
    await expect(page.getByTestId("consent-prompt")).toHaveCount(0);
    await expect.poll(async () => (await me(page)).guest?.playerId ?? null).not.toBeNull();
    expect(await guestCookie(context)).toBeDefined();

    await page.goto(GAME);
    await openRank(page);
    const my = page.getByTestId("rank-mine");
    await expect(my).toHaveAttribute("data-kind", "ranked");
    await expect(page.getByTestId("rank-mine-rank")).toHaveText(/^#\d/);
    await expect(my.getByTestId("guest-badge")).toHaveText("訪客");
    await expect(page.getByTestId("rank-row").first()).toBeVisible();
    for (const row of await page.locator('[data-testid="rank-row"][data-guest="true"]').all()) {
      await expect(row.locator('[data-testid="guest-badge"]:visible')).toHaveCount(1);
    }

    await page.goto("/me");
    await expect(page.getByTestId("me-account")).toHaveAttribute("data-guest", "true");
    await expect(page.getByTestId("me-account").getByTestId("guest-badge")).toHaveText("訪客");
    await page.goto("/me/settings");
    await expect(page.getByTestId("settings-logged-out")).toContainText("用 Google 登入才能自訂暱稱");
  });

  test("T3 T4 T6 T7 前 10 名、看前 100 名、標題列、你的名次各種狀態、讀不到時再試一次", async ({ page, browser }, info) => {
    // 今天的榜至少要有 11 個人
    const top = await (await page.request.get(`${LB}?scope=daily`)).json();
    for (let i = top.total; i < 11; i++) {
      const other = await newBrowser(browser);
      await postAsNew(other, [run(1000 + i)]);
      await other.close();
    }

    // 沒有身分：玩一局就會上榜＋登入按鈕
    await page.goto(GAME);
    await openRank(page);
    await expect(page.getByTestId("rank-row")).toHaveCount(10);
    await expect(page.getByTestId("rank-mine")).toHaveAttribute("data-kind", "join");
    await expect(page.getByTestId("rank-mine")).toContainText("玩一局就會上榜。");
    await expect(page.getByTestId("rank-mine").getByTestId("login-button")).toBeVisible();
    if (info.project.name === "desktop") await expect(page.getByTestId("rank-updated")).toContainText(/今天 0 點更新 · 已有 [\d,]+ 人上榜/);
    await page.getByTestId("rank-expand").click();
    expect(await page.getByTestId("rank-row").count()).toBeGreaterThan(10);
    expect(await page.getByTestId("rank-row").count()).toBeLessThanOrEqual(100);
    await page.getByTestId("rank-scope-week").click();
    await expect(page.getByTestId("rank-scope-week")).toHaveAttribute("aria-pressed", "true");
    if (info.project.name === "desktop") await expect(page.getByTestId("rank-updated")).toContainText("每週一 0 點重新開始");

    // 訪客：只玩過今日挑戰，自由模式這張榜還沒有成績（本機也有同一筆，讀不到名次時顯示它）。
    // 本機 D1 是所有測試共用的，今天的榜可能已經超過 100 人：真實資料只檢查有名次，前 100 名內的文字用固定回應檢查
    await postAsNew(page, [run(5996)]);
    await page.evaluate(([key, day]) => localStorage.setItem(key, JSON.stringify({ daily: { [day]: 5996 }, free: null, perfectStops: 0 })), [LOCAL, today()] as const);
    await page.reload();
    await openRank(page);
    await expect(page.getByTestId("rank-mine")).toHaveAttribute("data-kind", "ranked");
    await expect(page.getByTestId("rank-mine-rank")).toHaveText(/^#[\d,]+$/);
    await page.getByTestId("rank-scope-free").click();
    await expect(page.getByTestId("rank-mine")).toHaveAttribute("data-kind", "none");
    await expect(page.getByTestId("rank-mine")).toContainText("還沒有自由模式的成績");

    // 前 100 名內
    await page.route(`**${LB}/me?**`, (route) =>
      route.fulfill({ json: { rank: 37, score: 5996, total: 3000, toTop100: null }, headers: { "Cache-Control": "no-store" } }),
    );
    await page.getByTestId("rank-scope-daily").click();
    await expect(page.getByTestId("rank-mine-rank")).toHaveText("#37");
    await expect(page.getByTestId("rank-mine-note")).toContainText("今日挑戰的最佳 5,996 分");
    await page.unroute(`**${LB}/me?**`);

    // 100 名外
    await page.route(`**${LB}/me?**`, (route) =>
      route.fulfill({ json: { rank: 128, score: 4510, total: 3000, toTop100: 92 }, headers: { "Cache-Control": "no-store" } }),
    );
    await page.getByTestId("rank-scope-week").click();
    await expect(page.getByTestId("rank-mine-rank")).toHaveText("#128");
    await expect(page.getByTestId("rank-mine-note")).toHaveText(/再 92 分可以進前 100 名/);

    // 讀不到名次：只顯示自己的最佳分
    await page.unroute(`**${LB}/me?**`);
    await page.route(`**${LB}/me?**`, (route) => route.fulfill({ status: 500, body: "{}" }));
    await page.getByTestId("rank-scope-daily").click();
    await page.getByTestId("rank-scope-week").click();
    await expect(page.getByTestId("rank-mine-rank")).toHaveText("—");
    await expect(page.getByTestId("rank-mine-note")).toContainText("本週的最佳 5,996 分");

    // 讀不到前 100 名：不自動重試，按「再試一次」
    let calls = 0;
    await page.route(`**${LB}?scope=**`, (route) => {
      calls += 1;
      return route.fulfill({ status: 500, body: "{}" });
    });
    await page.reload();
    await openRank(page);
    await expect(page.getByTestId("rank-error")).toContainText("暫時讀不到排行");
    await page.waitForTimeout(1500);
    expect(calls).toBe(1);
    await page.unroute(`**${LB}?scope=**`);
    await page.getByTestId("rank-retry").click();
    await expect(page.getByTestId("rank-row").first()).toBeVisible();
  });

  test("T11 歐盟地區：結算問要不要上榜；不要就只存本機、改成上榜才建立訪客；/me 有開關", async ({ browser }) => {
    const context = await newBrowser(browser, { "cf-ipcountry": "FR" });
    const page = await hydratedPage(context);
    await enterGame(page);
    await playToFinal(page);
    await expect(page.getByTestId("consent-prompt")).toBeVisible();
    await expect(page.getByTestId("consent-prompt")).toContainText("要不要上全站排行？");
    await page.getByTestId("consent-no").click();
    await expect(page.getByTestId("consent-prompt")).toHaveCount(0);
    await page.waitForTimeout(1000);
    expect((await me(page)).guest).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem("game-station:leaderboard-consent"))).toBe("no");

    await page.goto(GAME);
    await openRank(page);
    await expect(page.getByTestId("rank-mine")).toHaveAttribute("data-kind", "declined");
    await page.getByTestId("rank-rejoin").click();
    await expect.poll(async () => (await me(page)).guest?.playerId ?? null).not.toBeNull();
    await expect(page.getByTestId("rank-mine")).toHaveAttribute("data-kind", "ranked");

    await page.goto("/me");
    await expect(page.getByTestId("consent-switch")).toHaveAttribute("aria-checked", "true");
    await context.close();
  });

  test("T11 歐盟地區：結算按「上榜」就建立訪客、這局送出", async ({ browser }) => {
    const context = await newBrowser(browser, { "cf-ipcountry": "CH" });
    const page = await hydratedPage(context);
    await enterGame(page, "free");
    await playToFinal(page);
    await page.getByTestId("consent-yes").click();
    await expect(page.getByTestId("consent-prompt")).toHaveCount(0);
    await expect.poll(async () => (await me(page)).guest?.playerId ?? null).not.toBeNull();
    const records = await (await page.request.get(RECORDS)).json();
    expect(records.free).toBeGreaterThan(0);
    await context.close();
  });

  test("T14 送給訪客、沒收到回應的那一批，登入 Google 後改送帳號，完美次數不重複加", async ({ page, context }) => {
    await postAsNew(page, [], 0);
    await enterGame(page);
    // 這一局送出：伺服器收到並寫入，但回應掉了
    await page.route(`**${RECORDS}/sync`, async (route) => {
      await route.fetch();
      await route.abort();
    });
    await playToFinal(page);
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("game-station:precise-stop:sync:v1") ?? "{}").outbox?.ambiguous ?? false))
      .toBe(true);
    await page.unroute(`**${RECORDS}/sync`);
    const local = JSON.parse((await page.evaluate((key) => localStorage.getItem(key), LOCAL))!) as { perfectStops: number };

    await login(page, context);
    await expect.poll(async () => (await (await page.request.get(RECORDS)).json()).perfectStops).toBe(local.perfectStops);
    await page.waitForTimeout(1000);
    expect((await (await page.request.get(RECORDS)).json()).perfectStops).toBe(local.perfectStops);
  });

  test("T15 /me 刪除訪客紀錄：焦點在取消；刪除後伺服器、cookie、本機都清掉，其他分頁也是；失敗時本機不清", async ({ page, context }) => {
    await postAsNew(page, [run(2222)], 1);
    await page.goto("/about");
    await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ daily: {}, free: 3333, perfectStops: 1 })), LOCAL);
    const other = await hydratedPage(context);
    await other.goto(GAME);
    await expect(other.getByTestId("record-free")).toHaveText("3,333");

    await page.goto("/me");
    await expect(page.getByTestId("guest-actions")).toBeVisible();

    // 失敗
    await page.route("**/api/guest**", (route) => route.fulfill({ status: 500, body: "{}" }));
    await page.getByTestId("guest-delete").click();
    await expect(page.locator(":focus")).toHaveText("取消");
    await page.getByTestId("guest-delete-confirm").click();
    await expect(page.getByRole("alert")).toContainText("沒有成功，等一下再試一次。");
    expect(await page.evaluate((key) => localStorage.getItem(key), LOCAL)).toContain("3333");
    await page.unroute("**/api/guest**");

    // 成功
    await page.getByTestId("guest-delete-confirm").click();
    await expect(page.getByText("已經刪除了。")).toBeVisible();
    expect(await guestCookie(context)).toBeUndefined();
    expect((await me(page)).guest).toBeNull();
    await expect(page.getByTestId("me-account")).not.toHaveAttribute("data-guest", "true");
    expect(JSON.parse((await page.evaluate((key) => localStorage.getItem(key), LOCAL))!)).toMatchObject({ free: null, perfectStops: 0 });
    await expect(other.getByTestId("record-free")).toHaveText("—");
  });

  test("T16 訪客 cookie 無效（被清掉）：當作沒有身分，下一局建立新訪客", async ({ page, context }) => {
    const first = (await postAsNew(page, [], 0)).body!.guest!.playerId;
    const stale = (await guestCookie(context))!;
    await enterGame(page);
    // 模擬 90 天被清掉：伺服器刪掉訪客，瀏覽器的 cookie 還在
    expect((await page.request.delete("/api/guest", { headers: { Origin: ORIGIN } })).status()).toBe(200);
    await context.addCookies([stale]);
    await playToFinal(page);
    await expect.poll(async () => (await me(page)).guest?.playerId ?? first).not.toBe(first);
    const records = await (await page.request.get(RECORDS)).json();
    expect(records.daily[today()]).toBeGreaterThan(0);
  });

  test("T19 T21 文字：頁尾、紀錄卡提示、隱私權政策；/me 只剩最佳紀錄", async ({ page }) => {
    await page.goto(GAME);
    await expect(page.locator("footer")).toContainText("沒登入時，成績會用訪客暱稱上榜。");
    await expect(page.getByTestId("login-hint")).toContainText("玩一局就會上榜。");
    await expect(page.getByTestId("login-hint")).toContainText("用 Google 登入，紀錄才會永久保留");

    await page.goto("/privacy");
    const main = page.locator("main");
    await expect(main).toContainText("排行榜與訪客代號");
    await expect(main).toContainText("gs_guest");
    await expect(main).toContainText("90 天沒玩會自動刪除");
    await expect(main).toContainText("歐洲經濟區、英國、瑞士");
    await expect(main).not.toContainText("收藏");
    await expect(main).not.toContainText("最近玩過");

    await page.goto("/me");
    await expect(page.locator("main")).not.toContainText("最近玩過");
    await expect(page.locator("main")).not.toContainText("收藏");
    await expect(page.getByTestId("me-bests")).toBeVisible();
    expect(await page.locator('meta[name="description"]').getAttribute("content")).not.toContain("收藏");
  });
});
