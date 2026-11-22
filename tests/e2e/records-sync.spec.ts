import { expect, test, type BrowserContext, type Page } from "./fixtures";
import { enterGame, GAME, playToFinal } from "./helpers";

/**
 * 精準停車紀錄接上帳號（驗收清單 P 組，帳號設計稿第 11 節）。
 * Google 由 tests/e2e/fake-google.mjs 假扮；每個測試用不同的 Google 帳號。
 */

const RECORDS = "game-station:precise-stop:v1";
const SYNC = "game-station:precise-stop:sync:v1";
const API = "/api/games/precise-stop/records";
const ORIGIN = "http://localhost:3000";

const unique = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const today = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);

async function asGoogleUser(context: BrowserContext, sub = `e2e-sync-${unique()}`) {
  await context.addCookies([{ name: "fake_sub", value: sub, domain: "localhost", path: "/" }]);
  return sub;
}

async function login(page: Page, path = GAME) {
  await page.goto(path);
  await page.getByTestId("login-button").first().click();
  await expect(page.getByTestId("banner-ok")).toBeVisible();
}

type Local = { daily?: Record<string, number>; free?: number | null; perfectStops?: number };

/** 在這台裝置放一份本機紀錄（沒有同步狀態：和這個功能上線前就玩過的人一樣，整份當作還沒上傳） */
async function seedLocal(page: Page, records: Local) {
  await page.goto("/about");
  await page.evaluate(
    ([key, sync, value]) => {
      localStorage.setItem(key, JSON.stringify(value));
      localStorage.removeItem(sync);
    },
    [RECORDS, SYNC, { daily: {}, free: null, perfectStops: 0, ...records }] as const,
  );
}

const readLocal = (page: Page) =>
  page.evaluate(([key, sync]) => ({ records: localStorage.getItem(key), sync: localStorage.getItem(sync) }), [RECORDS, SYNC] as const);

const account = async (page: Page) => (await page.request.get(API)).json();

/** 送同步請求；沒帶 playerId 時自動帶上目前登入的帳號（沒登入就不帶） */
async function syncRequest(page: Page, data: Record<string, unknown>, origin = ORIGIN) {
  let body = data;
  if (!("playerId" in data)) {
    const me = (await (await page.request.get("/api/me")).json()) as { playerId?: string };
    if (me.playerId) body = { ...data, playerId: me.playerId };
  }
  return page.request.post(`${API}/sync`, { headers: { Origin: origin }, data: body });
}

const run = (score: number, dateKey: string | null = null) => ({
  mode: dateKey ? "daily" : "free",
  dateKey,
  score,
  achievedAt: Date.now() - 1000,
});

test.describe("帳號紀錄 API", () => {
  test("P3 P6 沒登入：讀取 401、同步 401；跨站同步 403", async ({ request }) => {
    expect((await request.get(API)).status()).toBe(401);
    const body = { syncId: `id-${unique()}`, bests: [], perfectDelta: 0 };
    expect((await request.post(`${API}/sync`, { headers: { Origin: ORIGIN }, data: body })).status()).toBe(401);
    expect((await request.post(`${API}/sync`, { headers: { Origin: "https://evil.example" }, data: body })).status()).toBe(403);
  });

  test("P3 P4 P5 P6 登入後：取高分、同一批不重複加、範圍不對整批拒絕、超過 8 KB 拒絕", async ({ page, context }) => {
    await asGoogleUser(context);
    await login(page, "/me");
    expect(await account(page)).toEqual({ daily: {}, free: null, perfectStops: 0 });

    const day = today();
    const first = { syncId: `id-${unique()}`, bests: [run(3000, day), run(4000)], perfectDelta: 4 };
    let response = await syncRequest(page, first);
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ daily: { [day]: 3000 }, free: 4000, perfectStops: 4 });

    // 同一批重送：完美次數不重複加；中間夾著別的批次（例如另一台裝置）再重送也一樣（P4，資料庫觸發器一起加）
    expect(await (await syncRequest(page, first)).json()).toMatchObject({ perfectStops: 4 });
    const other = { syncId: `id-${unique()}`, bests: [], perfectDelta: 1 };
    expect(await (await syncRequest(page, other)).json()).toMatchObject({ perfectStops: 5 });
    expect(await (await syncRequest(page, first)).json()).toMatchObject({ perfectStops: 5 });

    // 較低的分數不覆蓋，較高的換上
    response = await syncRequest(page, { syncId: `id-${unique()}`, bests: [run(2000, day), run(4500)], perfectDelta: 1 });
    expect(await response.json()).toEqual({ daily: { [day]: 3000 }, free: 4500, perfectStops: 6 });

    // 一筆超過 6,000：整批拒絕，帳號不變
    response = await syncRequest(page, { syncId: `id-${unique()}`, bests: [run(5000, day), run(6001)], perfectDelta: 9 });
    expect(response.status()).toBe(400);
    expect(await account(page)).toEqual({ daily: { [day]: 3000 }, free: 4500, perfectStops: 6 });

    // 請求內容超過 8 KB
    response = await syncRequest(page, { syncId: `id-${unique()}`, bests: [], perfectDelta: 0, pad: "x".repeat(9000) });
    expect(response.status()).toBe(413);

    // 跨站
    expect((await syncRequest(page, first, "https://evil.example")).status()).toBe(403);

    // 帶的帳號不是目前登入的（另一個分頁換了帳號）：409，什麼都不寫
    response = await syncRequest(page, { syncId: `id-${unique()}`, playerId: "someone-else", bests: [run(5999)], perfectDelta: 7 });
    expect(response.status()).toBe(409);
    expect(await account(page)).toEqual({ daily: { [day]: 3000 }, free: 4500, perfectStops: 6 });
    expect((await page.request.get(`${API}?player=someone-else`)).status()).toBe(409);

    // 手機時鐘快一天：明天的今日挑戰收下，而且讀得回來；15 天前的略過，同一批的其他紀錄照收
    const tomorrow = new Date(Date.now() + 32 * 3600 * 1000).toISOString().slice(0, 10);
    const old = new Date(Date.now() + 8 * 3600 * 1000 - 15 * 86_400_000).toISOString().slice(0, 10);
    response = await syncRequest(page, { syncId: `id-${unique()}`, bests: [run(1200, tomorrow), run(900, old), run(4600)], perfectDelta: 0 });
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ daily: { [day]: 3000, [tomorrow]: 1200 }, free: 4600 });
    expect((await account(page)).daily[old]).toBeUndefined();
  });

  test("P6 同一人每分鐘超過 30 次回 429", async ({ page, context }) => {
    await asGoogleUser(context);
    await login(page, "/me");
    const statuses: number[] = [];
    for (let i = 0; i < 32; i++) {
      statuses.push((await syncRequest(page, { syncId: `id-${unique()}`, bests: [], perfectDelta: 0 })).status());
    }
    expect(statuses).toContain(429);
  });
});

test("P17 沒登入時只看介紹頁和 /me 不呼叫紀錄 API；玩完一局才送出（建立訪客，T8）", async ({ page }) => {
  const calls: { url: string; body: string | null }[] = [];
  page.on("request", (request) => {
    if (request.url().includes(API)) calls.push({ url: request.url(), body: request.postData() });
  });
  await seedLocal(page, { free: 1234, perfectStops: 2 });
  await page.goto(GAME);
  await expect(page.getByTestId("record-free")).toHaveText("1,234");
  await page.goto("/me");
  await expect(page.getByTestId("me-best-free")).toHaveText("1,234");
  await page.waitForTimeout(1000);
  expect(calls).toEqual([]);

  await enterGame(page);
  await playToFinal(page);
  await expect.poll(() => calls.length).toBeGreaterThan(0);
  expect(calls[0]!.url).toContain(`${API}/sync`);
  expect(JSON.parse(calls[0]!.body!)).toMatchObject({ playerId: null });
});

test("P7 P8 P15 登入時合併本機紀錄；換裝置看到同一份；重複登入不重複加", async ({ browser }) => {
  const sub = `e2e-sync-${unique()}`;
  const day = today();

  // A 裝置：沒登入時玩過
  const a = await browser.newContext();
  await asGoogleUser(a, sub);
  const pageA = await a.newPage();
  await seedLocal(pageA, { daily: { [day]: 3000 }, free: 2000, perfectStops: 5 });
  await login(pageA);
  await expect.poll(() => account(pageA)).toEqual({ daily: { [day]: 3000 }, free: 2000, perfectStops: 5 });

  // B 裝置：自由模式比較高，今日挑戰沒玩
  const b = await browser.newContext();
  await asGoogleUser(b, sub);
  const pageB = await b.newPage();
  await seedLocal(pageB, { free: 4000, perfectStops: 1 });
  await login(pageB);
  await expect(pageB.getByTestId("record-daily")).toHaveText("3,000");
  await expect(pageB.getByTestId("record-free")).toHaveText("4,000");
  await expect(pageB.getByTestId("record-perfect")).toHaveText("6 次");
  await expect(pageB.getByTestId("best-free")).toHaveText(/4,000/);

  // B 的 /me 也是帳號的紀錄，點了進介紹頁
  await pageB.goto("/me");
  await expect(pageB.getByTestId("me-best-daily")).toHaveText("3,000");
  await expect(pageB.getByTestId("me-best-free")).toHaveText("4,000");
  await expect(pageB.getByTestId("me-best-perfect")).toHaveText("6 次");
  await pageB.getByTestId("me-bests-precise-stop").click();
  await expect(pageB).toHaveURL(new RegExp(`${GAME}$`));

  // A 重新整理：看到 B 的分數
  await pageA.goto(GAME);
  await expect(pageA.getByTestId("record-free")).toHaveText("4,000");
  await expect(pageA.getByTestId("record-perfect")).toHaveText("6 次");

  // A 登出再登入：完美次數不會重複加
  await pageA.goto("/me");
  await pageA.getByRole("button", { name: "登出" }).click();
  await expect(pageA.getByTestId("banner-info")).toHaveText(/已經登出了/);
  await login(pageA, "/me");
  await expect(pageA.getByTestId("me-best-perfect")).toHaveText("6 次");
  expect(await account(pageA)).toMatchObject({ perfectStops: 6 });

  await a.close();
  await b.close();
});

test("P9 P10 P16 登入中玩完一局：新紀錄立刻顯示；送不出去時不顯示狀態，網路恢復後重送", async ({ page, context }) => {
  test.setTimeout(180_000);
  await asGoogleUser(context);
  await login(page);
  // 擋掉紀錄 API，模擬網路斷了
  await page.route(`**${API}/**`, (route) => route.abort());
  await page.route(`**${API}`, (route) => route.abort());

  await enterGame(page, "free");
  await playToFinal(page);
  await expect(page.getByTestId("record-note")).toHaveAttribute("data-new-record", "true");
  const total = Number(await page.getByTestId("final-total").getAttribute("data-total"));
  await expect(page.getByText(/同步|上傳/)).toHaveCount(0);
  const local = await readLocal(page);
  expect(JSON.parse(local.sync!).pending.bests.length + (JSON.parse(local.sync!).outbox?.bests.length ?? 0)).toBe(1);

  // 帳號裡還沒有
  await page.unroute(`**${API}/**`);
  await page.unroute(`**${API}`);
  expect(await account(page)).toMatchObject({ free: null });

  // 網路恢復：自動重送
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(async () => (await account(page)).free, { timeout: 30_000 }).toBe(total);
  await expect.poll(async () => JSON.parse((await readLocal(page)).sync!).outbox).toBeNull();
});

test("P11 P12 登出提醒：有沒送出的成績才提醒；登出後本機紀錄清空，其他分頁也清空；再登入拿回來", async ({ page, context }) => {
  await asGoogleUser(context);
  await login(page, "/me");
  // 帳號裡先有一筆
  await syncRequest(page, { syncId: `id-${unique()}`, bests: [run(4200)], perfectDelta: 3 });

  // 送不出去的狀態下，本機多了一局沒上傳的成績（整個瀏覽器都擋，其他分頁也送不出去）
  await context.route(`**${API}/sync`, (route) => route.abort());
  await page.evaluate(
    ([key, sync]) => {
      localStorage.setItem(key, JSON.stringify({ daily: {}, free: 4200, perfectStops: 4 }));
      localStorage.setItem(sync, JSON.stringify({ pending: { bests: [], perfectDelta: 1 }, outbox: null }));
    },
    [RECORDS, SYNC] as const,
  );
  await page.reload();
  const other = await context.newPage();
  await other.goto(GAME);
  await expect(other.getByTestId("record-free")).toHaveText("4,200");

  await page.getByRole("button", { name: "登出" }).click();
  const dialog = page.getByTestId("logout-pending");
  await expect(dialog).toContainText("還有成績沒存到帳號");
  await expect(dialog.getByRole("button", { name: "先不要登出" })).toBeFocused();
  await dialog.getByRole("button", { name: "先不要登出" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("me-account")).toContainText("已用 Google 登入");

  // 網路好了：按登出時先送成功，直接登出、不跳提醒
  await context.unroute(`**${API}/sync`);
  await page.getByRole("button", { name: "登出" }).click();
  await expect(page.getByTestId("banner-info")).toHaveText(/已經登出了/);
  await expect(page.getByTestId("logout-pending")).toHaveCount(0);
  expect(JSON.parse((await readLocal(page)).records!)).toEqual({ daily: {}, free: null, perfectStops: 0 });
  await expect(page.getByTestId("me-bests")).toContainText("還沒有紀錄");
  // 其他分頁也清空，而且變成未登入（之後那個分頁才不會把成績送進別的帳號）
  await expect(other.getByTestId("record-free")).toHaveText("—");
  await expect(other.getByTestId("login-hint")).toBeVisible();

  // 再登入：從帳號拿回來（含剛剛送出的那 1 次）
  await login(page, "/me");
  await expect(page.getByTestId("me-best-free")).toHaveText("4,200");
  await expect(page.getByTestId("me-best-perfect")).toHaveText("4 次");
});

test("P11 「仍要登出」：沒送出的成績跟著清掉", async ({ page, context }) => {
  await asGoogleUser(context);
  await login(page, "/me");
  await page.route(`**${API}/**`, (route) => route.abort());
  await page.evaluate(
    ([key, sync]) => {
      localStorage.setItem(key, JSON.stringify({ daily: {}, free: 1500, perfectStops: 0 }));
      localStorage.setItem(sync, JSON.stringify({ pending: { bests: [{ mode: "free", dateKey: null, score: 1500, achievedAt: Date.now() }], perfectDelta: 0 }, outbox: null }));
    },
    [RECORDS, SYNC] as const,
  );
  await page.reload();
  await page.getByRole("button", { name: "登出" }).click();
  await page.getByTestId("logout-pending").getByRole("button", { name: "仍要登出" }).click();
  await expect(page.getByTestId("banner-info")).toHaveText(/已經登出了/);
  expect(JSON.parse((await readLocal(page)).sync!)).toEqual({ pending: { bests: [], perfectDelta: 0 }, outbox: null });
  await page.unroute(`**${API}/**`);
  await login(page, "/me");
  await expect(page.getByTestId("me-bests")).toContainText("還沒有紀錄");
});

test("P13 登入過期（401）時不清本機紀錄，下次登入合併", async ({ page, context }) => {
  const sub = await asGoogleUser(context);
  await login(page);
  await page.evaluate(
    ([key, sync]) => {
      localStorage.setItem(key, JSON.stringify({ daily: {}, free: 2500, perfectStops: 2 }));
      localStorage.setItem(sync, JSON.stringify({ pending: { bests: [{ mode: "free", dateKey: null, score: 2500, achievedAt: Date.now() }], perfectDelta: 2 }, outbox: null }));
    },
    [RECORDS, SYNC] as const,
  );
  // session 過期：cookie 不見了，同步時伺服器回 401
  await context.clearCookies({ name: "gs_session" });
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByTestId("login-hint")).toBeVisible();
  expect(JSON.parse((await readLocal(page)).records!)).toMatchObject({ free: 2500 });

  await asGoogleUser(context, sub);
  await login(page);
  await expect.poll(() => account(page)).toMatchObject({ free: 2500, perfectStops: 2 });
});

test("P13 送給 A 帳號、沒收到回應的那一批，過期後換 B 帳號登入不會送進 B", async ({ page, context }) => {
  await asGoogleUser(context);
  await login(page);
  const me = (await (await page.request.get("/api/me")).json()) as { playerId: string };
  // A 的一批送出了但沒收到回應（outbox 還在，記著是 A 的）
  await page.evaluate(
    ([sync, owner]) => {
      localStorage.setItem(
        sync,
        JSON.stringify({ pending: { bests: [], perfectDelta: 0 }, outbox: { id: "id-from-a-0001", sentAt: null, bests: [], perfectDelta: 5, owner } }),
      );
    },
    [SYNC, me.playerId] as const,
  );
  await context.clearCookies({ name: "gs_session" });
  await asGoogleUser(context);
  await login(page);
  await expect.poll(async () => JSON.parse((await readLocal(page)).sync!).outbox).toBeNull();
  expect(await account(page)).toMatchObject({ perfectStops: 0 });
});

test("P12 P14 P18 刪除帳號：帳號紀錄刪掉、本機紀錄清掉；說明文字", async ({ page, context }) => {
  const sub = await asGoogleUser(context);
  await login(page, "/me");
  await syncRequest(page, { syncId: `id-${unique()}`, bests: [run(3300)], perfectDelta: 2 });
  await page.reload();
  await expect(page.getByTestId("me-best-free")).toHaveText("3,300");
  await expect(page.getByText("這台裝置上的紀錄也會清掉").first()).toBeVisible();

  await page.getByRole("button", { name: "刪除帳號" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("這台裝置上的紀錄也會清掉");
  await page.getByRole("alertdialog").getByRole("button", { name: "確定刪除" }).click();
  await expect(page.getByTestId("banner-info")).toHaveText(/已經刪除了/);
  await expect(page.getByTestId("me-bests")).toContainText("還沒有紀錄");

  // 同一個 Google 帳號再登入是新帳號：沒有任何紀錄
  await asGoogleUser(context, sub);
  await login(page, "/me");
  expect(await account(page)).toEqual({ daily: {}, free: null, perfectStops: 0 });
});

test("P15 我的紀錄頁：沒有紀錄時是空狀態；今天沒玩今日挑戰顯示「—」", async ({ page }) => {
  await page.goto("/me");
  await expect(page.getByTestId("me-bests")).toContainText("還沒有紀錄");
  await seedLocal(page, { daily: { "2026-01-01": 100 }, free: 900, perfectStops: 0 });
  await page.goto("/me");
  await expect(page.getByTestId("me-best-daily")).toHaveText("—");
  await expect(page.getByTestId("me-best-free")).toHaveText("900");
  await expect(page.getByTestId("me-best-perfect")).toHaveText("0 次");
});

test("P18 P19 隱私權政策的新段落；紀錄卡不寫同步；排行榜每列沒有 ★", async ({ page, context }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "帳號裡的遊戲紀錄" })).toBeVisible();
  await expect(page.getByText("登出時會清掉這台裝置上的紀錄")).toBeVisible();

  await asGoogleUser(context);
  await login(page);
  await expect(page.getByTestId("records-card")).not.toContainText("同步");

  await page.evaluate(() => localStorage.setItem("game-station:flags", "leaderboard"));
  await page.reload();
  await page.getByTestId("rank-tab").click();
  await expect(page.getByTestId("leaderboard")).toBeVisible();
  await expect(page.getByTestId("leaderboard")).not.toContainText("★");
});
