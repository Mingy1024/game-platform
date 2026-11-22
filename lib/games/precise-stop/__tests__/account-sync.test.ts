import { describe, expect, it } from "vitest";
import { dedupeBests, MAX_RUN_SCORE, overlay, parseAccountRecords, parseSyncBody, type BestEntry } from "../account-records";
import { emptyRecords } from "../records";
import { taiwanDateKey } from "../route";
import {
  addRun,
  confirmOutbox,
  displayRecords,
  emptySyncState,
  fromRecords,
  hasUnsynced,
  loadSyncState,
  addToInbox,
  forgetMemory,
  LOCK_MS,
  prune,
  readInbox,
  rejectOutboxBests,
  releaseOutbox,
  removeInbox,
  requeueOutbox,
  returnOutbox,
  runBatch,
  saveSyncState,
  withInbox,
  takeOutbox,
} from "../sync-state";

const NOW = Date.UTC(2026, 10, 21, 4, 0, 0); // 台灣 2026-11-21 12:00
const TODAY = taiwanDateKey(NOW);
const DAY = 86_400_000;
const body = (bests: unknown[], perfectDelta = 0, syncId = "abcdefgh12345678") => ({ syncId, playerId: "player-1", bests, perfectDelta });
const daily = (dateKey: string, score: number, achievedAt = NOW): BestEntry => ({ mode: "daily", dateKey, score, achievedAt });

function memoryStore(initial: Record<string, string> = {}) {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
    removeItem: (key: string) => {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- 測試用的假 localStorage
      delete data[key];
    },
    key: (index: number) => Object.keys(data)[index] ?? null,
    get length() {
      return Object.keys(data).length;
    },
  };
}

describe("P5 分數範圍檢查", () => {
  it("理論最高分是 6,000", () => {
    expect(MAX_RUN_SCORE).toBe(6000);
  });

  it("合格的一批：今日挑戰、自由模式、完美次數", () => {
    const parsed = parseSyncBody(
      body([daily(TODAY, 4812), { mode: "free", dateKey: null, score: 6000, achievedAt: NOW }], 17),
      NOW,
    );
    expect(parsed?.bests).toHaveLength(2);
    expect(parsed?.perfectDelta).toBe(17);
  });

  it.each([
    ["分數超過 6,000", body([daily(TODAY, 6001)])],
    ["分數是負的", body([daily(TODAY, -1)])],
    ["分數不是整數", body([daily(TODAY, 100.5)])],
    ["不認得的模式", body([{ mode: "rush", dateKey: TODAY, score: 1, achievedAt: NOW }])],
    ["自由模式帶日期", body([{ mode: "free", dateKey: TODAY, score: 1, achievedAt: NOW }])],
    ["今日挑戰沒有日期", body([{ mode: "daily", dateKey: null, score: 1, achievedAt: NOW }])],
    ["超過 15 筆", body(Array.from({ length: 16 }, () => daily(TODAY, 1)))],
    ["完美次數超過 10,000", body([], 10_001)],
    ["完美次數是負的", body([], -1)],
    ["syncId 太短", body([], 0, "abc")],
    ["多出不認得的欄位", { ...body([]), extra: 1 }],
    ["不是物件", "hello"],
  ])("%s：整批拒絕", (_name, raw) => {
    expect(parseSyncBody(raw, NOW)).toBeNull();
  });

  it("時間不對的只略過那一筆，同一批的其他紀錄和完美次數照收", () => {
    const free = { mode: "free", dateKey: null, score: 10, achievedAt: NOW };
    const parsed = parseSyncBody(
      body(
        [
          daily("2026/11/21", 1),
          daily("2026-02-31", 1),
          daily(taiwanDateKey(NOW + 2 * DAY), 1),
          daily(TODAY, 1, NOW + DAY + 1),
          free,
        ],
        4,
      ),
      NOW,
    );
    expect(parsed?.bests).toEqual([free]);
    expect(parsed?.perfectDelta).toBe(4);
  });

  it("手機時鐘快一點（1 天內）不拒絕：明天的日期、晚幾分鐘的創下時間", () => {
    expect(parseSyncBody(body([daily(taiwanDateKey(NOW + DAY), 1), daily(TODAY, 1, NOW + 60_000)]), NOW)).not.toBeNull();
  });

  it("超過 14 天的今日挑戰略過不存，同一批的其他紀錄和完美次數照收", () => {
    const parsed = parseSyncBody(
      body([daily(taiwanDateKey(NOW - 15 * DAY), 1), { mode: "free", dateKey: null, score: 10, achievedAt: NOW }], 2),
      NOW,
    );
    expect(parsed?.bests).toEqual([{ mode: "free", dateKey: null, score: 10, achievedAt: NOW }]);
    expect(parsed?.perfectDelta).toBe(2);
  });

  it("14 天前的今日挑戰還收", () => {
    expect(parseSyncBody(body([daily(taiwanDateKey(NOW - 14 * DAY), 1)]), NOW)).not.toBeNull();
  });

  it("一筆不合格，其他合格的也不收", () => {
    expect(parseSyncBody(body([daily(TODAY, 100), daily(TODAY, 9999)]), NOW)).toBeNull();
  });
});

describe("P4 合併：每筆取高分", () => {
  it("同一天只留最高分，同分時留比較早創下的", () => {
    const merged = dedupeBests([daily(TODAY, 100, NOW), daily(TODAY, 300, NOW - 10), daily(TODAY, 300, NOW - 20)]);
    expect(merged).toEqual([daily(TODAY, 300, NOW - 20)]);
  });

  it("疊在帳號紀錄上：較低的分數不覆蓋", () => {
    const account = { daily: { [TODAY]: 5000 }, free: 4000, perfectStops: 10 };
    const result = overlay(account, [daily(TODAY, 4000), { mode: "free", dateKey: null, score: 4500, achievedAt: NOW }], 3);
    expect(result).toEqual({ daily: { [TODAY]: 5000 }, free: 4500, perfectStops: 13 });
  });

  it("伺服器回應格式不對就當作失敗", () => {
    expect(parseAccountRecords({ daily: {}, free: null, perfectStops: 0 })).not.toBeNull();
    expect(parseAccountRecords({ daily: {}, free: "x", perfectStops: 0 })).toBeNull();
    expect(parseAccountRecords(null)).toBeNull();
  });
});

describe("P7 P10 還沒存到帳號的紀錄", () => {
  it("這個功能上線前就有的本機紀錄，第一次讀取時整份當作還沒上傳", () => {
    const store = memoryStore();
    const records = { daily: { [TODAY]: 4000 }, free: 5000, perfectStops: 7 };
    const state = loadSyncState(store, records, NOW);
    expect(state.pending.perfectDelta).toBe(7);
    expect(state.pending.bests).toHaveLength(2);
    // 已經存下來了，第二次讀到的是同一份，不會再重算
    expect(loadSyncState(store, { ...records, perfectStops: 99 }, NOW).pending.perfectDelta).toBe(7);
  });

  it("舊的本機紀錄裡分數超出範圍的不送", () => {
    const state = fromRecords({ daily: { [TODAY]: 3000 }, free: 6001, perfectStops: 1 }, NOW);
    expect(state.pending.bests).toEqual([daily(TODAY, 3000)]);
  });

  it("沒有本機紀錄時是空的", () => {
    expect(hasUnsynced(fromRecords(emptyRecords(), NOW))).toBe(false);
  });

  it("每局都加完美次數和分數（不管本機算不算破紀錄），同一天同一模式只留最高的一筆", () => {
    let state = emptySyncState();
    state = addRun(state, { mode: "daily", dateKey: TODAY, total: 2000, perfectStops: 1, isNewRecord: false }, NOW);
    state = addRun(state, { mode: "daily", dateKey: TODAY, total: 3000, perfectStops: 2, isNewRecord: false }, NOW);
    state = addRun(state, { mode: "free", dateKey: TODAY, total: 4000, perfectStops: 0, isNewRecord: true }, NOW);
    expect(state.pending.perfectDelta).toBe(3);
    expect(state.pending.bests).toEqual([daily(TODAY, 3000), { mode: "free", dateKey: null, score: 4000, achievedAt: NOW }]);
  });

  it("送出時搬進 outbox；失敗後重送用同一個 syncId（伺服器不會重複加完美次數）", () => {
    let state = addRun(emptySyncState(), { mode: "free", dateKey: null, total: 1, perfectStops: 2, isNewRecord: true }, NOW);
    const first = takeOutbox(state, NOW, () => "id-first-0001");
    expect(first?.outbox).toMatchObject({ id: "id-first-0001", perfectDelta: 2 });
    state = releaseOutbox(first!.state, "id-first-0001");
    // 送的期間又玩了一局：新的進 pending，不混進正在送的那一批
    state = addRun(state, { mode: "free", dateKey: null, total: 0, perfectStops: 1, isNewRecord: false }, NOW);
    const retry = takeOutbox(state, NOW + 1, () => "id-second-002");
    expect(retry?.outbox.id).toBe("id-first-0001");
    expect(retry?.outbox.perfectDelta).toBe(2);
    expect(hasUnsynced(confirmOutbox(retry!.state, "id-first-0001"))).toBe(true);
  });

  it("其他分頁正在送同一批時不重送；過了鎖定時間才重送", () => {
    const state = addRun(emptySyncState(), { mode: "free", dateKey: null, total: 1, perfectStops: 1, isNewRecord: true }, NOW);
    const taken = takeOutbox(state, NOW, () => "id-lock-00001")!;
    expect(takeOutbox(taken.state, NOW + 1000, () => "x")).toBeNull();
    expect(takeOutbox(taken.state, NOW + LOCK_MS, () => "x")?.outbox.id).toBe("id-lock-00001");
  });

  it("沒有要送的就不建立 outbox", () => {
    expect(takeOutbox(emptySyncState(), NOW, () => "x")).toBeNull();
  });

  it("送出前濾掉超過 14 天的今日挑戰，其他照送（不會整批被拒絕）", () => {
    const old = daily(taiwanDateKey(NOW - 20 * DAY), 5000, NOW - 20 * DAY);
    const state = { pending: { bests: [old, daily(TODAY, 3000)], perfectDelta: 2 }, outbox: null };
    const taken = takeOutbox(state, NOW, () => "id-filter-001")!;
    expect(taken.outbox.bests).toEqual([daily(TODAY, 3000)]);
    expect(taken.outbox.perfectDelta).toBe(2);
    expect(hasUnsynced(confirmOutbox(taken.state, "id-filter-001"))).toBe(false);
  });

  it("重送的那一批裡有這段期間過期的今日挑戰：拿掉它，同一個 syncId 照送", () => {
    const expiring = daily(taiwanDateKey(NOW - 14 * DAY), 5000, NOW - 14 * DAY);
    const state = { pending: { bests: [], perfectDelta: 0 }, outbox: { id: "id-retry-0001", sentAt: null, bests: [expiring, daily(TODAY, 1)], perfectDelta: 3 } };
    const retry = takeOutbox(state, NOW + DAY, () => "x")!;
    expect(retry.outbox.id).toBe("id-retry-0001");
    expect(retry.outbox.bests).toEqual([daily(TODAY, 1)]);
    expect(retry.outbox.perfectDelta).toBe(3);
  });

  it("只剩過期的紀錄時清掉，不會一直算成「還沒上傳」", () => {
    const old = daily(taiwanDateKey(NOW - 20 * DAY), 5000, NOW - 20 * DAY);
    const state = { pending: { bests: [old], perfectDelta: 0 }, outbox: null };
    expect(takeOutbox(state, NOW, () => "x")).toBeNull();
    expect(hasUnsynced(prune(state, NOW))).toBe(false);
  });

  it("超過上限的拆成好幾批：一批最多 15 筆、完美次數 10,000", () => {
    const bests = Array.from({ length: 16 }, (_, i) => daily(taiwanDateKey(NOW - i * DAY), 100 + i));
    const valid = bests.slice(0, 15); // 第 16 筆是 15 天前，濾掉
    const state = {
      pending: { bests: [...valid, { mode: "free" as const, dateKey: null, score: 1, achievedAt: NOW }], perfectDelta: 12_000 },
      outbox: null,
    };
    const first = takeOutbox(state, NOW, () => "id-split-0001")!;
    expect(first.outbox.bests).toHaveLength(15);
    expect(first.outbox.perfectDelta).toBe(10_000);
    const second = takeOutbox(confirmOutbox(first.state, "id-split-0001"), NOW, () => "id-split-0002")!;
    expect(second.outbox.bests).toHaveLength(1);
    expect(second.outbox.perfectDelta).toBe(2000);
  });

  it("寫入失敗（空間滿了）之後，以記憶體裡比較新的那份為準", () => {
    const store = memoryStore();
    const records = emptyRecords();
    saveSyncState(store, emptySyncState());
    const full = { ...store, setItem: () => { throw new Error("QuotaExceededError"); } };
    const next = addRun(emptySyncState(), { mode: "free", dateKey: null, total: 1, perfectStops: 3, isNewRecord: true }, NOW);
    saveSyncState(full, next);
    expect(loadSyncState(full, records, NOW).pending.perfectDelta).toBe(3);
    // 之後寫入成功，又以瀏覽器裡的為準
    saveSyncState(store, emptySyncState());
    expect(loadSyncState(store, records, NOW).pending.perfectDelta).toBe(0);
  });
});

describe("P16 同步回來後顯示的紀錄", () => {
  it("帳號紀錄疊上還沒上傳的部分；別的裝置的高分直接換上", () => {
    let state = addRun(emptySyncState(), { mode: "daily", dateKey: TODAY, total: 3000, perfectStops: 1, isNewRecord: true }, NOW);
    state = addRun(state, { mode: "free", dateKey: null, total: 2000, perfectStops: 0, isNewRecord: true }, NOW);
    const account = { daily: { [TODAY]: 4500 }, free: 1000, perfectStops: 20 };
    expect(displayRecords(account, state)).toEqual({ daily: { [TODAY]: 4500 }, free: 2000, perfectStops: 21 });
  });

  it("本機只留最近 14 天", () => {
    const account = {
      daily: Object.fromEntries(Array.from({ length: 15 }, (_, i) => [taiwanDateKey(NOW - i * DAY), i])),
      free: null,
      perfectStops: 0,
    };
    const shown = displayRecords(account, emptySyncState());
    expect(Object.keys(shown.daily)).toHaveLength(14);
    expect(shown.daily[taiwanDateKey(NOW - 14 * DAY)]).toBeUndefined();
  });
});

describe("P10 P12 inbox：剛玩完的局各自存一個 key", () => {
  it("每一局一個 key，收的時候合成一批；只刪收進來的那幾個，之後新增的留著", () => {
    forgetMemory();
    const store = memoryStore();
    addToInbox(store, runBatch({ mode: "free", dateKey: null, total: 3000, perfectStops: 2, isNewRecord: true }, NOW), "run-a");
    addToInbox(store, runBatch({ mode: "free", dateKey: null, total: 2000, perfectStops: 1, isNewRecord: false }, NOW), "run-b");
    const inbox = readInbox(store);
    expect(inbox.batch).toEqual({ bests: [{ mode: "free", dateKey: null, score: 3000, achievedAt: NOW }], perfectDelta: 3 });
    // 收的期間另一個分頁又玩完一局
    addToInbox(store, runBatch({ mode: "free", dateKey: null, total: 100, perfectStops: 4, isNewRecord: false }, NOW), "run-c");
    removeInbox(store, inbox.keys);
    expect(readInbox(store).batch.perfectDelta).toBe(4);
  });

  it("瀏覽器不能儲存時記在記憶體，登出時（其他分頁）可以丟掉", () => {
    forgetMemory();
    addToInbox(null, { bests: [], perfectDelta: 5 }, "run-m");
    expect(readInbox(null).batch.perfectDelta).toBe(5);
    forgetMemory();
    expect(readInbox(null).batch.perfectDelta).toBe(0);
  });

  it("併進 pending 時各取高分、完美次數相加", () => {
    const state = addRun(emptySyncState(), { mode: "free", dateKey: null, total: 1000, perfectStops: 1, isNewRecord: true }, NOW);
    const merged = withInbox(state, { bests: [{ mode: "free", dateKey: null, score: 2000, achievedAt: NOW }], perfectDelta: 2 });
    expect(merged.pending).toEqual({ bests: [{ mode: "free", dateKey: null, score: 2000, achievedAt: NOW }], perfectDelta: 3 });
  });
});

describe("P10 重送與被拒", () => {
  it("拿到 Web Lock 時，重新整理前留下的 outbox 直接用同一個 syncId 重送，不等鎖定時間", () => {
    const state = { pending: { bests: [], perfectDelta: 0 }, outbox: { id: "id-reload-001", sentAt: NOW, bests: [], perfectDelta: 2 } };
    expect(takeOutbox(state, NOW + 1000, () => "x")).toBeNull();
    expect(takeOutbox(state, NOW + 1000, () => "x", { exclusive: true })?.outbox.id).toBe("id-reload-001");
  });

  it("送給 A 帳號、沒收到回應的那一批，換成 B 帳號後不再重送；從沒送過的 pending 照樣送給 B", () => {
    const state = {
      pending: { bests: [], perfectDelta: 1 },
      outbox: { id: "id-owner-0001", sentAt: null, bests: [], perfectDelta: 5, owner: "player-a" },
    };
    expect(takeOutbox(state, NOW, () => "x", { owner: "player-a" })?.outbox.id).toBe("id-owner-0001");
    const forB = takeOutbox(state, NOW, () => "id-owner-0002", { owner: "player-b" })!;
    expect(forB.outbox).toMatchObject({ id: "id-owner-0002", perfectDelta: 1, owner: "player-b" });
  });

  it("409（帳號不符，伺服器沒寫）：第一次送就被拒的放回 pending；之前有過不明確結果的留著", () => {
    const outbox = { id: "id-409-00001", sentAt: NOW, bests: [daily(TODAY, 1)], perfectDelta: 2, owner: "player-a" };
    const fresh = returnOutbox({ pending: { bests: [], perfectDelta: 1 }, outbox }, "id-409-00001");
    expect(fresh).toEqual({ pending: { bests: [daily(TODAY, 1)], perfectDelta: 3 }, outbox: null });
    const ambiguous = releaseOutbox({ pending: { bests: [], perfectDelta: 0 }, outbox }, "id-409-00001");
    expect(returnOutbox(ambiguous, "id-409-00001").outbox).toMatchObject({ id: "id-409-00001", sentAt: null, ambiguous: true });
  });

  it("伺服器拒絕（400）：最佳紀錄不再送，完美次數用同一個 syncId 再送", () => {
    const state = { pending: { bests: [], perfectDelta: 0 }, outbox: { id: "id-reject-01", sentAt: NOW, bests: [daily(TODAY, 1)], perfectDelta: 2 } };
    expect(rejectOutboxBests(state, "id-reject-01").outbox).toEqual({ id: "id-reject-01", sentAt: null, bests: [], perfectDelta: 2 });
    const noDelta = { ...state, outbox: { ...state.outbox, perfectDelta: 0 } };
    expect(rejectOutboxBests(noDelta, "id-reject-01").outbox).toBeNull();
  });
});

describe("T8 T14 T16 排行榜訪客：outbox 送給誰", () => {
  const outbox = (extra: Record<string, unknown>) => ({
    pending: { bests: [], perfectDelta: 1 },
    outbox: { id: "id-guest-0001", sentAt: null, bests: [], perfectDelta: 4, ...extra },
  });
  const take = (state: ReturnType<typeof outbox>, kind: "google" | "guest" | "new", owner?: string) =>
    takeOutbox(state as never, NOW, () => "id-fresh-0001", { owner, kind, exclusive: true })!;

  it("還沒有身分時建立的 outbox 標成 new，不帶 owner", () => {
    const taken = takeOutbox({ pending: { bests: [], perfectDelta: 2 }, outbox: null }, NOW, () => "id-new-00001", { kind: "new" })!;
    expect(taken.outbox).toMatchObject({ id: "id-new-00001", ownerKind: "new" });
    expect(taken.outbox.owner).toBeUndefined();
  });

  it("new 的那一批之後可以送給訪客或 Google 帳號（同一個 syncId，伺服器擋重複）", () => {
    const state = outbox({ ownerKind: "new" });
    expect(take(state, "guest", "guest-1").outbox).toMatchObject({ id: "id-guest-0001", owner: "guest-1", ownerKind: "guest" });
    expect(take(state, "google", "acct-1").outbox).toMatchObject({ id: "id-guest-0001", owner: "acct-1", ownerKind: "google" });
    expect(take(state, "new").outbox).toMatchObject({ id: "id-guest-0001", ownerKind: "new" });
  });

  it("T14 送給訪客、還沒收到回應的那一批，登入 Google 後改送新帳號", () => {
    const state = outbox({ owner: "guest-1", ownerKind: "guest", ambiguous: true });
    expect(take(state, "google", "acct-1").outbox).toMatchObject({ id: "id-guest-0001", owner: "acct-1", ownerKind: "google", perfectDelta: 4 });
  });

  it("T16 訪客被清掉後：舊訪客的那一批不送給新的訪客，也不在沒有身分時送出；pending 照樣送", () => {
    const state = outbox({ owner: "guest-1", ownerKind: "guest", ambiguous: true });
    expect(take(state, "guest", "guest-2").outbox).toMatchObject({ id: "id-fresh-0001", perfectDelta: 1 });
    expect(take(state, "new").outbox).toMatchObject({ id: "id-fresh-0001", perfectDelta: 1, ownerKind: "new" });
  });

  it("送給 Google 帳號的那一批不會改送給訪客", () => {
    const state = outbox({ owner: "acct-1", ownerKind: "google" });
    expect(take(state, "guest", "guest-1").outbox.id).toBe("id-fresh-0001");
  });

  it("T8 送出格式：playerId 可以是 null（請建立訪客）、consent 只能是 true", () => {
    expect(parseSyncBody({ ...body([]), playerId: null }, NOW)?.playerId).toBeNull();
    expect(parseSyncBody({ ...body([]), playerId: null, consent: true }, NOW)?.consent).toBe(true);
    expect(parseSyncBody({ ...body([]), consent: false }, NOW)).toBeNull();
  });
});

describe("2026-11-22 Codex 審查：送出後沒有結果、撤回同意", () => {
  it("上次送出後沒有任何結果（分頁關掉）：接手時當作不明確，409 也保留同一個 syncId", () => {
    const state = {
      pending: { bests: [], perfectDelta: 1 },
      outbox: { id: "id-closed-001", sentAt: NOW - 60_000, bests: [], perfectDelta: 4, owner: "guest-1", ownerKind: "guest" as const },
    };
    const taken = takeOutbox(state, NOW, () => "x", { owner: "guest-1", kind: "guest", exclusive: true })!;
    expect(taken.outbox).toMatchObject({ id: "id-closed-001", ambiguous: true });
    const after409 = returnOutbox(taken.state, "id-closed-001");
    expect(after409.outbox).toMatchObject({ id: "id-closed-001", sentAt: null, ambiguous: true });
    // 之後改送 Google 帳號：同一個 syncId（登入時批次代碼已經搬進帳號，伺服器擋重複）
    expect(takeOutbox(after409, NOW, () => "y", { owner: "acct-1", kind: "google", exclusive: true })!.outbox.id).toBe("id-closed-001");
  });

  it("這一頁剛送出、收到 409：沒有不明確的結果，放回 pending", () => {
    const fresh = takeOutbox({ pending: { bests: [], perfectDelta: 2 }, outbox: null }, NOW, () => "id-fresh-409", { kind: "guest", owner: "g" })!;
    expect(fresh.outbox.ambiguous).toBeUndefined();
    expect(returnOutbox(fresh.state, "id-fresh-409")).toEqual({ pending: { bests: [], perfectDelta: 2 }, outbox: null });
  });

  it("撤回同意時刪掉剛建立的訪客：這一批放回 pending（不論是否不明確）", () => {
    const state = { pending: { bests: [], perfectDelta: 1 }, outbox: { id: "id-revoke-01", sentAt: NOW, bests: [daily(TODAY, 5)], perfectDelta: 2, ambiguous: true } };
    expect(requeueOutbox(state, "id-revoke-01")).toEqual({ pending: { bests: [daily(TODAY, 5)], perfectDelta: 3 }, outbox: null });
  });
});
