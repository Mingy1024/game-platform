import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nick = (custom: string | null) => ({ adjective: 0, noun: 0, number: 1, custom });
const me = (custom: string | null, nickNextAt: string | null = null) => ({ loggedIn: true, nick: nick(custom), nickNextAt });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
/** 現在之後 days 天的時間（冷卻日期要在未來才會採用） */
const daysLater = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

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
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    const remove = store.deleteAccount();
    pending[1].resolve(json({ ok: true }));
    await remove;
    pending[0].resolve(json(me("新名字", daysLater(7))));
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

  it("改名成功之後，送出更早的讀取才回來：保留改名結果，讀取回 committed", async () => {
    const refresh = store.refreshMe({ keepOnError: true });
    const save = store.saveNick("新名字");
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    pending[1].resolve(json(me("新名字", daysLater(7))));
    expect(await save).toEqual({ ok: true });
    pending[0].resolve(json(me("舊名字")));
    expect(await refresh).toBe("committed");
    expect(customOf(store)).toBe("新名字");
  });

  it("too_soon 後重新讀取失敗：stale，冷卻時間先寫進狀態", async () => {
    const next = daysLater(7);
    const save = store.saveNick("新名字");
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    pending[0].resolve(json({ error: "too_soon", nickNextAt: next }, 409));
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    pending[1].resolve(json({}, 500));
    expect(await save).toEqual({ ok: false, error: "stale", nickNextAt: new Date(next) });
    const state = store.readMe();
    expect(state.status === "loggedIn" && state.nickNextAt?.toISOString()).toBe(next);
  });

  it("too_soon 後重新讀取時冷卻已經結束：改提示 conflict，冷卻以讀到的為準", async () => {
    const save = store.saveNick("新名字");
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    pending[0].resolve(json({ error: "too_soon", nickNextAt: "2026-11-21T00:00:00.000Z" }, 409));
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    pending[1].resolve(json(me("別的分頁的名字")));
    expect(await save).toEqual({ ok: false, error: "conflict", synced: true });
    expect(customOf(store)).toBe("別的分頁的名字");
  });

  it("conflict 後重新讀取到冷卻中：改提示 too_soon，附最新的日期", async () => {
    const next = daysLater(7);
    const save = store.saveNick("新名字");
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    pending[0].resolve(json({ error: "conflict" }, 409));
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    pending[1].resolve(json(me("別的分頁的名字", next)));
    expect(await save).toEqual({ ok: false, error: "too_soon", nickNextAt: new Date(next), synced: true });
  });

  it("同時送出兩次改名：第二次等第一次回來才送，回應不會倒退", async () => {
    const first = store.saveNick("名字甲");
    const second = store.saveNick(null);
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    // 第一次還沒回來，第二次還沒送出
    await Promise.resolve();
    expect(pending).toHaveLength(1);
    pending[0].resolve(json(me("名字甲", daysLater(7))));
    await first;
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    expect(JSON.parse(String((vi.mocked(fetch).mock.calls.at(-1)?.[1] as RequestInit).body))).toEqual({ custom: null });
    pending[1].resolve(json(me(null, daysLater(7))));
    await second;
    expect(customOf(store)).toBeNull();
  });

  it("讀取到未登入（別的分頁登出）後，晚到的改名成功不會改回登入", async () => {
    const save = store.saveNick("新名字");
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    const refresh = store.refreshMe();
    pending[1].resolve(json({ loggedIn: false }));
    expect(await refresh).toBe("ended");
    pending[0].resolve(json(me("新名字", daysLater(7))));
    await save;
    expect(customOf(store)).toBe("loggedOut");
  });

  it("重新讀取失敗時，不採用已經過期或比較舊的冷卻日期", async () => {
    const later = daysLater(7);
    // 狀態裡已經有比較晚的冷卻日期
    const save = store.saveNick("新名字");
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    pending[0].resolve(json({ error: "too_soon", nickNextAt: later }, 409));
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    pending[1].resolve(json({}, 500));
    await save;

    // 比較早的日期：不蓋掉
    const earlier = store.resyncNick(new Date(daysLater(3)));
    await vi.waitFor(() => expect(pending).toHaveLength(3));
    pending[2].resolve(json({}, 500));
    expect(await earlier).toEqual({ ok: false, error: "stale", nickNextAt: new Date(later) });

    // 已經過期的日期：不採用（狀態裡沒有冷卻時，表單不會被鎖住）
    const refresh = store.refreshMe();
    pending[3].resolve(json(me("舊名字")));
    await refresh;
    const expired = store.resyncNick(new Date(Date.now() - 1000));
    await vi.waitFor(() => expect(pending).toHaveLength(5));
    pending[4].resolve(json({}, 500));
    expect(await expired).toEqual({ ok: false, error: "stale", nickNextAt: undefined });
    const state = store.readMe();
    expect(state.status === "loggedIn" && state.nickNextAt).toBeNull();
  });
});

describe("前端登入狀態：第一次讀取", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("FEATURE_LOGIN", "1");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("第一次讀取被保留狀態的讀取取代、後者失敗：變成 error，不會停在載入中；下次用到時再讀一次", async () => {
    const store = await import("../me-store");
    const pending = deferredFetch();
    store.ensureMe();
    const newer = store.refreshMe({ keepOnError: true });
    pending[0].resolve(json(me("名字")));
    pending[1].resolve(json({}, 500));
    expect(await newer).toBe("failed");
    expect(store.readMe().status).toBe("error");

    store.ensureMe();
    expect(pending).toHaveLength(3);
    pending[2].resolve(json(me("名字")));
    await vi.waitFor(() => expect(store.readMe().status).toBe("loggedIn"));
  });
});
