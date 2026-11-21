import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nick = (custom: string | null) => ({ adjective: 0, noun: 0, number: 1, custom });
const me = (custom: string | null, nickNextAt: string | null = null) => ({ loggedIn: true, nick: nick(custom), nickNextAt });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** 可以手動決定回應順序的 fetch：pending[i] 是第 i 個送出的請求 */
function deferredFetch() {
  const pending: { url: string; method: string; resolve: (response: Response) => void }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => new Promise<Response>((resolve) => pending.push({ url, method: init?.method ?? "GET", resolve }))),
  );
  return pending;
}

type Store = typeof import("../me-store");
const customOf = (store: Store) => {
  const state = store.readMe();
  return state.status === "loggedIn" ? state.nick.custom : state.status;
};

describe("前端登入狀態：回應順序和送出順序不同時", () => {
  let store: Store;
  let pending: ReturnType<typeof deferredFetch>;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("FEATURE_LOGIN", "1");
    store = await import("../me-store");
    pending = deferredFetch();
    // 先登入，暱稱是「舊名字」
    const first = store.refreshMe();
    pending[0].resolve(json(me("舊名字")));
    await first;
    pending.length = 0;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("讀取比登出晚回來：維持登出，讀取結果是 ended", async () => {
    const refresh = store.refreshMe({ keepOnError: true });
    const logout = store.logout();
    pending[1].resolve(json({ ok: true }));
    await logout;
    pending[0].resolve(json(me("舊名字")));
    expect(await refresh).toBe("ended");
    expect(customOf(store)).toBe("loggedOut");
  });

  it("改名成功比刪除帳號晚回來：維持登出", async () => {
    const save = store.saveNick("新名字");
    const remove = store.deleteAccount();
    pending[1].resolve(json({ ok: true }));
    await remove;
    pending[0].resolve(json(me("新名字", "2026-11-28T00:00:00.000Z")));
    await save;
    expect(customOf(store)).toBe("loggedOut");
  });

  it("舊的讀取比新的晚回來：保留新的資料，兩次都回 applied", async () => {
    const older = store.refreshMe({ keepOnError: true });
    const newer = store.refreshMe({ keepOnError: true });
    pending[1].resolve(json(me("新名字")));
    expect(await newer).toBe("applied");
    pending[0].resolve(json(me("舊名字")));
    expect(await older).toBe("applied");
    expect(customOf(store)).toBe("新名字");
  });

  it("舊的讀取先回來、新的失敗：兩次都回 failed，不寫入舊資料", async () => {
    const older = store.refreshMe({ keepOnError: true });
    const newer = store.refreshMe({ keepOnError: true });
    pending[0].resolve(json(me("過時的名字")));
    pending[1].resolve(json({}, 500));
    expect(await older).toBe("failed");
    expect(await newer).toBe("failed");
    expect(customOf(store)).toBe("舊名字");
  });

  it("改名成功之後，送出更早的讀取才回來：保留改名結果", async () => {
    const refresh = store.refreshMe({ keepOnError: true });
    const save = store.saveNick("新名字");
    pending[1].resolve(json(me("新名字", "2026-11-28T00:00:00.000Z")));
    expect(await save).toEqual({ ok: true });
    pending[0].resolve(json(me("舊名字")));
    expect(await refresh).toBe("applied");
    expect(customOf(store)).toBe("新名字");
  });

  it("too_soon 後重新讀取失敗：stale，冷卻時間先寫進狀態", async () => {
    const next = "2026-11-28T00:00:00.000Z";
    const save = store.saveNick("新名字");
    pending[0].resolve(json({ error: "too_soon", nickNextAt: next }, 409));
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    pending[1].resolve(json({}, 500));
    expect(await save).toEqual({ ok: false, error: "stale", nickNextAt: new Date(next) });
    const state = store.readMe();
    expect(state.status === "loggedIn" && state.nickNextAt?.toISOString()).toBe(next);
  });

  it("too_soon 後重新讀取時冷卻已經結束：改提示 conflict，冷卻以讀到的為準", async () => {
    const save = store.saveNick("新名字");
    pending[0].resolve(json({ error: "too_soon", nickNextAt: "2026-11-21T00:00:00.000Z" }, 409));
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    pending[1].resolve(json(me("別的分頁的名字")));
    expect(await save).toEqual({ ok: false, error: "conflict", synced: true });
    expect(customOf(store)).toBe("別的分頁的名字");
  });

  it("conflict 後重新讀取到冷卻中：改提示 too_soon，附最新的日期", async () => {
    const next = "2026-11-28T00:00:00.000Z";
    const save = store.saveNick("新名字");
    pending[0].resolve(json({ error: "conflict" }, 409));
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    pending[1].resolve(json(me("別的分頁的名字", next)));
    expect(await save).toEqual({ ok: false, error: "too_soon", nickNextAt: new Date(next), synced: true });
  });
});
