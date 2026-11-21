import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const LOGGED_IN = {
  loggedIn: true,
  nick: { adjective: 0, noun: 0, number: 1, custom: "阿明號" },
  nickNextAt: null,
};

/** 可以手動決定什麼時候回應的 fetch */
function deferredFetch() {
  const pending: { url: string; resolve: (response: Response) => void }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => new Promise<Response>((resolve) => pending.push({ url, resolve }))),
  );
  return pending;
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("前端登入狀態", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("FEATURE_LOGIN", "1");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("重新讀取比登出晚回來時，不會把狀態改回登入", async () => {
    const store = await import("../me-store");
    const pending = deferredFetch();
    const refresh = store.refreshMe({ keepOnError: true });
    const logout = store.logout();
    pending[1].resolve(json({ ok: true }));
    await logout;
    expect(store.readMe().status).toBe("loggedOut");
    pending[0].resolve(json(LOGGED_IN));
    expect(await refresh).toBe(true);
    expect(store.readMe().status).toBe("loggedOut");
  });

  it("too_soon 後重新讀取失敗：回傳 stale 並保留原因與冷卻時間", async () => {
    const store = await import("../me-store");
    const pending = deferredFetch();
    const first = store.refreshMe();
    pending[0].resolve(json(LOGGED_IN));
    await first;

    const next = "2026-11-28T00:00:00.000Z";
    const save = store.saveNick("新名字");
    pending[1].resolve(json({ error: "too_soon", nickNextAt: next }, 409));
    await vi.waitFor(() => expect(pending).toHaveLength(3));
    pending[2].resolve(json({}, 500));
    expect(await save).toEqual({ ok: false, error: "stale", cause: "too_soon", nickNextAt: new Date(next) });
    const state = store.readMe();
    expect(state.status === "loggedIn" && state.nickNextAt?.toISOString()).toBe(next);
  });
});
