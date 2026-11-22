import { randomId } from "@/lib/account/crypto";
import { readConsent, writeConsent } from "@/lib/account/leaderboard-consent";
import {
  adoptGuest,
  expireGuest,
  expireSession,
  markConsentRequired,
  readMe,
  refreshMe,
  subscribeMe,
  subscribeSignOut,
  withTimeout,
} from "@/lib/account/me-store";
import type { GuestInfo } from "@/lib/account/player";
import { FLAGS } from "@/lib/flags";
import { parseAccountRecords } from "./account-records";
import {
  clearLocalRecords,
  collectInbox,
  loadStoredSyncState,
  readSyncState,
  replaceRecords,
  subscribeRuns,
  writeSyncState,
} from "./records-store";
import {
  confirmOutbox,
  displayRecords,
  dropForeignOutbox,
  forgetMemory,
  forgetStateMemory,
  hasUnsynced,
  rejectOutboxBests,
  releaseOutbox,
  returnOutbox,
  takeOutbox,
  type Target,
} from "./sync-state";

/**
 * 精準停車的紀錄跟著帳號走（帳號設計稿第 11.4 節）。只在瀏覽器端執行，由 app/plugins/account-sync.client.ts 啟動。
 * 改這個檔案前先看 docs/dev/sync-checklist.md（共用狀態、請求結果、登入狀態的檢查表）。
 *
 * 共用狀態與寫入者（檢查表第 1 節）：
 * - 本機紀錄 game-station:precise-stop:v1：顯示用的快取。玩完一局（recordRun）和同步回應（replaceRecords）都會寫，
 *   可能短暫顯示舊值；真正的資料是「伺服器＋同步狀態＋inbox」，下一輪同步會重建。
 * - 同步狀態 game-station:precise-stop:sync:v1：只在 Web Lock 裡寫（round），登出時清空。
 *   例外：第一次讀到不存在時，用本機紀錄建立（內容固定，兩個分頁同時建立結果相同）。
 * - inbox game-station:precise-stop:run:<代碼>：玩完一局時新增，只在 Web Lock 裡收走刪除。
 * - 登出記號 game-station:account:signed-out：登出、刪除帳號時寫，其他分頁收到就當作已登出。
 *
 * - 變成已登入時（登入回來、打開網站）：有還沒上傳的就送 sync（自動合併，第 15 題），沒有就讀帳號紀錄；
 *   回來後把本機紀錄換成「帳號紀錄＋還沒上傳的部分」。
 * - 登入中玩完一局：送 sync。送不出去時留著，網路恢復、下次打開介紹頁或 /me、下一局結束時再送（第 17 題）。
 * - 在這一頁按登出、刪除帳號成功：清掉本機紀錄（第 16 題）。
 * - 伺服器回 401（session 過期）：當作已登出，但本機紀錄留著（P13）。
 *
 * 排行榜的訪客（精準停車設計稿第 14.2、14.6 節）：沒用 Google 登入時也會送，對象是這個瀏覽器的訪客（gs_guest），
 * 還沒有訪客就請伺服器建立（playerId: null）。
 * - 還沒有身分的人只在這一頁玩完一局之後才送（P17：只看介紹頁和 /me 不呼叫紀錄 API）
 * - 歐盟地區要先在結算按「上榜」（consent: true）；選了「不要」或還沒決定就不送，成績只存本機（T11）
 * - 403 consent_required：放回 pending、結算出現上榜詢問；429（建立太多）：留著下次再送（T10）
 * - 訪客 cookie 無效（401）：當作沒有身分，舊的那一批不送給新的訪客（T16）
 * - 刪除訪客紀錄（me-store 的 deleteGuest）和登出一樣清掉本機紀錄、通知其他分頁（T15）
 */
export type SyncResult = "ok" | "failed" | "unauthorized" | "skipped";

const RECORDS_URL = "/api/games/precise-stop/records";
/** 一次同步最多連送幾批（送的期間又玩完一局時，接著送新的那批） */
const MAX_ROUNDS = 3;

let started = false;
let running: Promise<SyncResult> | null = null;
let again = false;
/** 登出時加一：登出前送出的請求，回來後不採用 */
let epoch = 0;

/**
 * 其他分頁登出時，這一頁的 epoch 不會變；改在本機留一個記號，送出前後比對。
 * 記號變了表示這段期間有分頁登出（本機紀錄已經清空），回應不能再寫回去。
 */
const SIGN_OUT_KEY = "game-station:account:signed-out";
function signOutMark(): string | null {
  try {
    return window.localStorage.getItem(SIGN_OUT_KEY);
  } catch {
    return null;
  }
}
function markSignOut() {
  try {
    window.localStorage.setItem(SIGN_OUT_KEY, `${Date.now()}-${randomId(8)}`);
  } catch {
    // 不能儲存時只有這一頁的 epoch
  }
}
let lastStatus = "loading";
let lastPlayer: string | undefined;

const loggedIn = () => readMe().status === "loggedIn";
const currentPlayer = () => {
  const me = readMe();
  return me.status === "loggedIn" ? me.playerId : undefined;
};

/** 這一頁玩完過一局：還沒有身分的人從這之後才會送（建立訪客） */
let playedHere = false;

/**
 * 現在要送給誰；不能送時是 null（登入狀態還不知道、排行榜關閉、歐盟地區沒同意）。
 * consent：歐盟地區按過「上榜」，建立訪客時要附上
 */
function currentTarget(): (Target & { consent?: true }) | null {
  const me = readMe();
  if (me.status === "loggedIn") return { kind: "google", owner: me.playerId };
  if (!FLAGS.leaderboard || me.status !== "loggedOut") return null;
  if (me.guest) return { kind: "guest", owner: me.guest.playerId };
  if (!me.consentRequired) return { kind: "new" };
  return readConsent() === "yes" ? { kind: "new", consent: true } : null;
}

/**
 * 同一個瀏覽器的分頁之間一次只做一輪（Web Locks）：取出要送的那一批、送出、套用回應都在鎖裡，
 * 兩個分頁不會把同一批用不同的 syncId 各送一次，慢回來的讀取也不會蓋掉另一個分頁剛送完的結果。
 * 不支援 Web Locks 的瀏覽器退回 outbox 的 sentAt 鎖定（sync-state.ts 的 LOCK_MS）。
 */
const SYNC_LOCK = "game-station:precise-stop:sync";
const hasWebLocks = () => typeof navigator !== "undefined" && typeof navigator.locks?.request === "function";
function withSyncLock<T>(task: () => Promise<T>): Promise<T> {
  if (!hasWebLocks()) return task();
  return navigator.locks.request(SYNC_LOCK, task) as Promise<T>;
}

/** 讀帳號紀錄或送一批，回來後換掉本機紀錄。回傳 more 表示還有下一批要送 */
async function round(): Promise<{ result: SyncResult; more: boolean }> {
  const at = epoch;
  const mark = signOutMark();
  const stale = () => at !== epoch || mark !== signOutMark();
  // 剛玩完的局（inbox）在鎖裡收進共用狀態，再取出要送的一批
  const target = currentTarget();
  if (!target) return { result: "skipped", more: false };
  const owner = target.owner;
  const collected = collectInbox();
  // 寫不進瀏覽器：這一輪不送（records-store.ts 的 collectInbox）
  if (!collected) return { result: "failed", more: false };
  const own = dropForeignOutbox(collected, target);
  if (own !== collected) writeSyncState(own);
  const taken = takeOutbox(own, Date.now(), randomId, { exclusive: hasWebLocks(), owner, kind: target.kind });
  // 要送的這一批一定要先存進瀏覽器才送：只記在記憶體的話，其他分頁看不到，會用新的 syncId 把同一份再送一次
  if (taken && !writeSyncState(taken.state)) {
    // 記憶體裡那份（帶著新的 syncId）也丟掉，下一輪從瀏覽器裡最後存好的狀態重來
    forgetStateMemory();
    return { result: "failed", more: false };
  }
  // 沒有 Web Locks、而且其他分頁正在送同一批：這次只讀帳號紀錄
  const blocked = !taken && hasUnsynced(readSyncState());
  // 訪客和還沒有身分的人：沒有要送的就不讀（只有 Google 帳號需要換裝置時拿回紀錄）
  if (!taken && target.kind !== "google") return { result: blocked ? "failed" : "ok", more: false };

  // 附上這一頁以為登入的帳號：另一個分頁換了帳號時，伺服器回 409、什麼都不寫
  const response = await fetch(
    taken ? `${RECORDS_URL}/sync` : `${RECORDS_URL}?player=${encodeURIComponent(owner ?? "")}`,
    withTimeout(
      taken
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              syncId: taken.outbox.id,
              playerId: owner ?? null,
              bests: taken.outbox.bests,
              perfectDelta: taken.outbox.perfectDelta,
              ...(target.consent ? { consent: true } : {}),
            }),
          }
        : { cache: "no-store", credentials: "same-origin" },
    ),
  ).catch(() => null);

  const release = () => {
    if (taken) writeSyncState(releaseOutbox(loadStoredSyncState(), taken.outbox.id));
  };
  // 送出之後登出了：不採用（登出時本機紀錄已經清掉）
  if (stale()) return { result: "skipped", more: false };
  if (!response) {
    release();
    return { result: "failed", more: false };
  }
  if (response.status === 401) {
    // 伺服器在寫入前就拒絕了：這一批放回 pending，之後送給新的身分；之前有過不明確結果的（可能已經存進原本那裡）
    // 留著，換身分時由 dropForeignOutbox 丟掉（P13、T16）。
    // Google 的 session 過期：當作已登出、本機紀錄留著（P13）。訪客 cookie 無效（被刪除、90 天被清掉）：當作沒有身分
    if (taken) writeSyncState(returnOutbox(loadStoredSyncState(), taken.outbox.id));
    if (target.kind === "google") expireSession();
    else expireGuest();
    return { result: "unauthorized", more: false };
  }
  if (taken && response.status === 403) {
    const error = ((await response.json().catch(() => null)) as { error?: string } | null)?.error;
    if (stale()) return { result: "skipped", more: false };
    if (error === "consent_required") {
      // 伺服器確定沒有建立訪客：放回 pending，結算出現上榜詢問（T11）
      writeSyncState(returnOutbox(loadStoredSyncState(), taken.outbox.id));
      markConsentRequired();
      return { result: "failed", more: false };
    }
    release();
    return { result: "failed", more: false };
  }
  if (response.status === 409) {
    // 另一個分頁換了帳號，伺服器什麼都沒寫：重新讀取登入狀態。
    // 這一批從沒有過不明確的結果就放回 pending（併進目前的帳號），不然留著、換帳號後由 dropForeignOutbox 丟掉
    if (taken) writeSyncState(returnOutbox(loadStoredSyncState(), taken.outbox.id));
    epoch += 1;
    void refreshMe();
    return { result: "failed", more: false };
  }
  if (taken && response.status === 400) {
    // 格式或分數範圍不對（第 18 題；正常的前端不會送出）：最佳紀錄不再送，完美次數用同一個 syncId 再送
    writeSyncState(rejectOutboxBests(loadStoredSyncState(), taken.outbox.id));
    return { result: "failed", more: false };
  }
  const json = response.ok ? ((await response.json().catch(() => null)) as { guest?: GuestInfo } | null) : null;
  const account = parseAccountRecords(json);
  if (stale()) return { result: "skipped", more: false };
  if (!account) {
    release();
    return { result: "failed", more: false };
  }
  if (taken) writeSyncState(confirmOutbox(loadStoredSyncState(), taken.outbox.id));
  // 伺服器建立（或找回）的訪客：記下來，之後的批次送給它
  if (target.kind !== "google" && json?.guest && typeof json.guest.playerId === "string") adoptGuest(json.guest);
  // 顯示用的狀態包含送出期間又玩完的局（inbox），才不會被這次的回應蓋掉
  const view = readSyncState();
  replaceRecords(displayRecords(account, view));
  if (blocked) return { result: "failed", more: false };
  return { result: "ok", more: hasUnsynced(view) };
}

/**
 * 同步一次（同一時間只跑一個）。登出提醒（P11）用它先試送一次：
 * 回傳 ok 表示目前所有紀錄都已經存到帳號。
 */
export function syncNow(): Promise<SyncResult> {
  if (!FLAGS.login) return Promise.resolve("skipped");
  // 沒登入 Google、還不知道有沒有訪客（例如直接打開遊戲畫面）：先讀一次登入狀態
  const status = readMe().status;
  if (FLAGS.leaderboard && (status === "loading" || status === "error")) {
    return refreshMe({ keepOnError: true }).then(() => (currentTarget() ? syncNow() : "skipped"));
  }
  if (!currentTarget()) return Promise.resolve("skipped");
  // 正在跑：記下來，跑完這輪再補一輪（這段期間可能又多了要送的紀錄，例如剛好網路恢復）
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    let result: SyncResult = "skipped";
    for (let i = 0; i < MAX_ROUNDS; i++) {
      again = false;
      const step = await withSyncLock(round);
      result = step.result;
      // 身分失效（401）時，換成新身分觸發的那一次（例如訪客被清掉、這一頁剛玩完一局）記在 again，接著送
      if (!currentTarget() || result === "skipped" || (result === "unauthorized" && !again)) break;
      // 失敗時只有這段期間又有新的觸發（例如網路剛恢復）才再試，不然等下一次觸發
      if (result !== "ok" ? !again : !step.more && !again) break;
    }
    return result;
  })().finally(() => {
    running = null;
  });
  return running;
}

/** 還有沒存到帳號的紀錄嗎 */
export const hasUnsyncedRecords = () => hasUnsynced(readSyncState());

/**
 * 有還沒上傳的紀錄、而且已經知道是登入狀態就送。
 * 登入狀態還不知道時不主動問伺服器：沒登入時玩的也算「還沒上傳」，主動問的話，
 * 沒登入的人每次打開網站都會多一個請求。會顯示紀錄的介紹頁和 /me 本來就會讀登入狀態，
 * 讀到已登入時（startAccountSync 的 subscribeMe）就會送。
 */
function kick() {
  if (!hasUnsyncedRecords()) return;
  if (loggedIn()) {
    void syncNow();
    return;
  }
  // 訪客：已經有身分，照樣重送。還沒有身分：這一頁玩過一局才送（建立訪客，P17）
  const me = readMe();
  if (FLAGS.leaderboard && me.status === "loggedOut" && (me.guest || playedHere)) void syncNow();
}

/**
 * 歐盟地區按「上榜」（結算的詢問、排行榜的「改成上榜」）：記下選擇，馬上把成績送出去（建立訪客）
 */
export function joinLeaderboard() {
  writeConsent("yes");
  playedHere = true;
  if (hasUnsyncedRecords()) void syncNow();
}

/** 歐盟地區按「不要」：記下選擇，成績只存本機 */
export const declineLeaderboard = () => writeConsent("no");

/** 顯示紀錄的元件掛上時呼叫（站內換頁到介紹頁、/me 時也會重送；app/composables/store.ts 的 useRecords） */
export const retryAccountSync = () => {
  if (started) kick();
};

export function startAccountSync() {
  if (!FLAGS.login || started) return;
  started = true;
  // 變成已登入、或登入的帳號換了（另一個分頁換帳號後重新讀到）時同步。
  // 訪客換了（建立好、或被清掉後變成沒有身分）時，有還沒送的才送
  subscribeMe(() => {
    const status = readMe().status;
    const player = currentPlayer() ?? currentTarget()?.owner;
    const changed = status !== lastStatus || player !== lastPlayer;
    lastStatus = status;
    lastPlayer = player;
    if (!changed) return;
    if (status === "loggedIn") void syncNow();
    else if (status === "loggedOut") kick();
  });
  subscribeSignOut(() => {
    epoch += 1;
    markSignOut();
    clearLocalRecords();
  });
  // 這一頁玩完一局時。不聽其他分頁的寫入：同步過程本身也會寫入，會讓分頁之間互相觸發、一直重送
  // 登入狀態還不知道時 syncNow 會先讀一次（直接打開遊戲畫面的情況）
  subscribeRuns(() => {
    playedHere = true;
    if (hasUnsyncedRecords() && (loggedIn() || FLAGS.leaderboard)) void syncNow();
  });
  window.addEventListener("online", kick);
  // 其他分頁登出（或刪除帳號）：這一頁也當作已登出，再重新讀取登入狀態。
  // 那個分頁之後可能登入了別的帳號，不重新讀取的話，這一頁會把成績送進新帳號、卻還顯示舊帳號
  window.addEventListener("storage", (event) => {
    if (event.key !== SIGN_OUT_KEY) return;
    epoch += 1;
    forgetMemory();
    expireSession();
    void refreshMe();
  });
  if (readMe().status === "loggedIn") {
    lastStatus = "loggedIn";
    lastPlayer = currentPlayer();
    void syncNow();
  } else kick();
}
