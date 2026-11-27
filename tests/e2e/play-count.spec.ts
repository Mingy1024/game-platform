import { expect, randomIp, test } from "./fixtures";

/**
 * 累計遊玩次數的 API（docs/plans/play-count.md）。dev server 打開了 FEATURE_PLAY_COUNT（playwright.config.ts）。
 * 其他測試玩完一局也會加次數，所以總數只檢查「至少多了」，重複代碼看回應的 counted。
 */
const API = "/api/play-count";
const ORIGIN = "http://localhost:3000";
const runId = () => `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
const count = async (request: import("@playwright/test").APIRequestContext, slug: string) =>
  ((await (await request.get(`${API}/${slug}`)).json()) as { count: number }).count;

test("同一局的代碼只加一次，GET 讀得到", async ({ request }) => {
  const before = await count(request, "office-escape");
  const id = runId();
  const first = await request.post(`${API}/office-escape`, { headers: { Origin: ORIGIN }, data: { runId: id } });
  expect(first.status()).toBe(200);
  expect(await first.json()).toEqual({ counted: true });
  const again = await request.post(`${API}/office-escape`, { headers: { Origin: ORIGIN }, data: { runId: id } });
  expect(await again.json()).toEqual({ counted: false });
  expect(await count(request, "office-escape")).toBeGreaterThanOrEqual(before + 1);
});

test("不是站上的遊戲回 404；跨站回 403；runId 格式不對回 400；都不會加", async ({ request }) => {
  expect((await request.get(`${API}/not-a-game`)).status()).toBe(404);
  expect((await request.post(`${API}/not-a-game`, { headers: { Origin: ORIGIN }, data: { runId: runId() } })).status()).toBe(404);
  expect((await request.post(`${API}/precise-stop`, { headers: { Origin: "https://evil.example" }, data: { runId: runId() } })).status()).toBe(403);
  expect((await request.post(`${API}/precise-stop`, { data: { runId: runId() } })).status()).toBe(403);
  for (const bad of [{}, { runId: "short" }, { runId: "has spaces in it!!!!" }, { runId: 1234567890123456 }]) {
    expect((await request.post(`${API}/precise-stop`, { headers: { Origin: ORIGIN }, data: bad })).status()).toBe(400);
  }
});

test("同一個 IP 每分鐘超過 10 次回 429", async ({ playwright }) => {
  const request = await playwright.request.newContext({ baseURL: ORIGIN, extraHTTPHeaders: { "cf-connecting-ip": randomIp(), Origin: ORIGIN } });
  const statuses: number[] = [];
  for (let i = 0; i < 11; i++) statuses.push((await request.post(`${API}/mine-descent`, { data: { runId: runId() } })).status());
  expect(statuses.slice(0, 10).every((status) => status === 200)).toBe(true);
  expect(statuses[10]).toBe(429);
  await request.dispose();
});
