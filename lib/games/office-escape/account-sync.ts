import { randomId } from "@/lib/account/crypto";
import { readConsent, writeConsent } from "@/lib/account/leaderboard-consent";
import {
  adoptGuest,
  expireGuest,
  expireSession,
  markConsentRequired,
  readMe,
  refreshMe,
  revokeGuest,
  subscribeGuestMerged,
  subscribeMe,
  subscribeSignOut,
  withTimeout,
} from "@/lib/account/me-store";
import type { GuestInfo } from "@/lib/account/player";
import { FLAGS } from "@/lib/flags";
import { overlay, parseAccountRecords } from "./account-records";
import {
  adoptAccountRecords,
  clearLocalRecords,
  collectInbox,
  loadStoredPending,
  readPendingView,
  savePendingState,
  subscribeRuns,
} from "./records-store";
import { forgetPendingMemory, removeConfirmed } from "./sync-state";

/**
 * 下班逃離辦公室的紀錄跟著帳號走、訪客也能上榜。只在瀏覽器端執行，由 app/plugins/account-sync.client.ts 啟動。
 * 改這個檔案前先看 docs/dev/sync-checklist.md 和 docs/plans/office-escape.md（共用狀態、請求結果、登入狀態的檢查表）。
 *
 * 和精準停車最大的差別：伺服器只取高分、沒有累計次數，所以重送一定是冪等的，
 * 不需要 outbox、批次代碼、「不明確的結果」。待上傳的紀錄存在 pending（sync-state.ts），
 * 送出成功後只移除「分數不高於送出那筆」的項目。
 *
 * - 變成已登入時（登入回來、打開網站）：有還沒上傳的就送 sync，沒有就讀帳號紀錄；
 *   回來後把本機紀錄換成「帳號紀錄與本機各取高分」。
 * - 登入中玩完一局：送 sync。送不出去時留著，網路恢復、下次打開介紹頁或 /me、下一局結束時再送（P9）。
 * - 在這一頁按登出、刪除帳號、刪除訪客：清掉本機紀錄與 pending（P11）。
 * - 伺服器回 401：Google 當作已登出、本機紀錄留著（P12）；訪客 cookie 無效當作沒有身分。
 * - 沒用 Google 登入時也送，對象是這個瀏覽器的訪客（gs_guest），還沒有就請伺服器建立（playerId: null）。
 *   還沒有身分的人只在這一頁玩完一局後才送（P17：只看介紹頁和 /me 不呼叫紀錄 API）；
 *   歐盟地區要先在結算按「上榜」（consent: true），選了「不要」或還沒決定就不送（T11）。
 */
export type SyncResult = "ok" | "failed" | "unauthorized" | "skipped";

const RECORDS_URL = "/api/games/office-escape/records";
const MAX_ROUNDS = 3;

let started = false;
let running: Promise<SyncResult> | null = null;
let again = false;
/** 登出時加一：登出前送出的請求，回來後不採用 */
let epoch = 0;

/** 其他分頁登出時，這一頁的 epoch 不會變；本機的記號變了表示這段期間有分頁登出，回應不能再寫回去（和精準停車同一個記號） */
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

type Target = { kind: "google" | "guest" | "new"; owner?: string; consent?: true };

/** 現在要送給誰；不能送時是 null（登入狀態還不知道、排行榜關閉、歐盟地區沒同意） */
function currentTarget(): Target | null {
  const me = readMe();
  if (me.status === "loggedIn") return { kind: "google", owner: me.playerId };
  if (!FLAGS.leaderboard || me.status !== "loggedOut") return null;
  // 歐盟地區撤回了同意：已經有訪客也不再送
  if (me.consentRequired && readConsent() === "no") return null;
  if (me.guest) return { kind: "guest", owner: me.guest.playerId };
  if (!me.consentRequired) return { kind: "new" };
  return readConsent() === "yes" ? { kind: "new", consent: true } : null;
}

/** 同一個瀏覽器的分頁之間一次只做一輪（Web Locks）。不支援時不鎖：所有寫入都是冪等的取高分，多送一次不會出錯 */
const SYNC_LOCK = "game-station:office-escape:sync";
const hasWebLocks = () => typeof navigator !== "undefined" && typeof navigator.locks?.request === "function";
function withSyncLock<T>(task: () => Promise<T>): Promise<T> {
  if (!hasWebLocks()) return task();
  return navigator.locks.request(SYNC_LOCK, task) as Promise<T>;
}

const hasUnsynced = () => readPendingView().bests.length > 0;

/** 讀帳號紀錄或送一批，回來後換掉本機紀錄。回傳 more 表示送的期間又有新的要送 */
async function round(): Promise<{ result: SyncResult; more: boolean }> {
  const at = epoch;
  const mark = signOutMark();
  const stale = () => at !== epoch || mark !== signOutMark();
  const target = currentTarget();
  if (!target) return { result: "skipped", more: false };
  const owner = target.owner;
  const collected = collectInbox();
  // 寫不進瀏覽器：這一輪不送（records-store.ts 的 collectInbox）
  if (!collected) return { result: "failed", more: false };
  const sending = collected.bests;
  // 要送的 guestSyncId 一定要先存進瀏覽器才送：不然回應掉了、重送時會換一個代碼，建立出第二個訪客（T9）
  if (sending.length > 0 && target.kind === "new" && !savePendingState(collected)) {
    forgetPendingMemory();
    return { result: "failed", more: false };
  }
  // 訪客和還沒有身分的人：沒有要送的就不讀（只有 Google 帳號需要換裝置時拿回紀錄）
  if (sending.length === 0 && target.kind !== "google") return { result: "ok", more: false };

  const response = await fetch(
    sending.length > 0 ? `${RECORDS_URL}/sync` : `${RECORDS_URL}?player=${encodeURIComponent(owner ?? "")}`,
    withTimeout(
      sending.length > 0
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            // 附上這一頁以為登入的帳號：另一個分頁換了帳號時，伺服器回 409、什麼都不寫
            body: JSON.stringify({
              syncId: collected.guestSyncId,
              playerId: owner ?? null,
              bests: sending,
              ...(target.consent ? { consent: true } : {}),
            }),
          }
        : { cache: "no-store", credentials: "same-origin" },
    ),
  ).catch(() => null);

  // 送出之後登出了：不採用（登出時本機紀錄已經清掉）
  if (stale()) return { result: "skipped", more: false };
  if (!response) return { result: "failed", more: false };
  if (response.status === 401) {
    // 伺服器在寫入前就拒絕了，pending 原封不動：Google 的 session 過期當作已登出、本機紀錄留著（P12）；訪客 cookie 無效當作沒有身分
    if (target.kind === "google") expireSession();
    else expireGuest();
    return { result: "unauthorized", more: false };
  }
  if (sending.length > 0 && response.status === 403) {
    const error = ((await response.json().catch(() => null)) as { error?: string } | null)?.error;
    if (stale()) return { result: "skipped", more: false };
    if (error === "consent_required") {
      // 伺服器確定沒有建立訪客：pending 留著，結算出現上榜詢問（T11）
      markConsentRequired();
    }
    return { result: "failed", more: false };
  }
  if (response.status === 409) {
    // 另一個分頁換了帳號，伺服器什麼都沒寫：重新讀取登入狀態，pending 留著送給新的身分
    epoch += 1;
    void refreshMe();
    return { result: "failed", more: false };
  }
  if (sending.length > 0 && response.status === 400) {
    // 格式或分數範圍不對（正常的前端不會送出）：丟掉這一批，不再重送壞資料
    savePendingState(removeConfirmed(loadStoredPending(), sending));
    return { result: "failed", more: false };
  }
  const json = response.ok ? ((await response.json().catch(() => null)) as { guest?: GuestInfo } | null) : null;
  const account = parseAccountRecords(json);
  if (stale()) return { result: "skipped", more: false };
  if (!account) return { result: "failed", more: false };
  const guest = target.kind !== "google" && json?.guest && typeof json.guest.playerId === "string" ? json.guest : null;
  if (guest && target.consent && readConsent() !== "yes") {
    // 送出期間使用者在別的分頁撤回了上榜同意：剛建立的訪客立刻刪掉、不公開，本機紀錄與 pending 留著
    void revokeGuest(guest.playerId);
    return { result: "skipped", more: false };
  }
  // 已確認：只移除分數不高於送出那筆的（送出期間新增的更高分留著）
  if (sending.length > 0) savePendingState(removeConfirmed(loadStoredPending(), sending));
  // 伺服器建立（或找回）的訪客：記下來，之後的批次送給它
  if (guest) adoptGuest(guest);
  // 顯示用的狀態：帳號紀錄、還沒上傳的、本機（送出期間又玩完的局）各取高分
  const view = readPendingView();
  adoptAccountRecords(overlay(account, view.bests));
  return { result: "ok", more: view.bests.length > 0 };
}

/**
 * 同步一次（同一時間只跑一個）。登出提醒（P10）用它先試送一次：回傳 ok 表示目前所有紀錄都已經存到帳號。
 */
export function syncNow(): Promise<SyncResult> {
  if (!FLAGS.login) return Promise.resolve("skipped");
  // 沒登入 Google、還不知道有沒有訪客（例如直接打開遊戲畫面）：先讀一次登入狀態
  const status = readMe().status;
  if (FLAGS.leaderboard && (status === "loading" || status === "error")) {
    return refreshMe({ keepOnError: true }).then(() => (currentTarget() ? syncNow() : "skipped"));
  }
  if (!currentTarget()) return Promise.resolve("skipped");
  // 正在跑：記下來，跑完這輪再補一輪（這段期間可能又多了要送的紀錄）
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
export const hasUnsyncedRecords = () => hasUnsynced();

/**
 * 有還沒上傳的紀錄、而且已經知道是登入狀態就送。登入狀態還不知道時不主動問伺服器：
 * 沒登入的人每次打開網站都會多一個請求。會顯示紀錄的介紹頁和 /me 本來就會讀登入狀態，讀到已登入時就會送。
 */
function kick() {
  if (!hasUnsyncedRecords()) return;
  if (loggedIn()) {
    void syncNow();
    return;
  }
  const me = readMe();
  if (FLAGS.leaderboard && me.status === "loggedOut" && (me.guest || playedHere)) void syncNow();
}

/** 歐盟地區按「上榜」：記下選擇，馬上把成績送出去（建立訪客） */
export function joinLeaderboard() {
  writeConsent("yes");
  playedHere = true;
  if (hasUnsyncedRecords()) void syncNow();
}

/** 歐盟地區按「不要」：記下選擇，成績只存本機 */
export const declineLeaderboard = () => writeConsent("no");

/** 顯示紀錄的元件掛上時呼叫（站內換頁到介紹頁、/me 時也會重送） */
export const retryAccountSync = () => {
  if (started) kick();
};

export function startAccountSync() {
  if (!FLAGS.login || started) return;
  started = true;
  // 變成已登入、或登入的帳號換了時同步；訪客換了時，有還沒送的才送
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
  // 登出、刪除帳號、刪除訪客：在登入狀態改變之前呼叫（me-store），清完才會有人用新的身分觸發同步
  subscribeSignOut(() => {
    epoch += 1;
    playedHere = false;
    markSignOut();
    clearLocalRecords();
  });
  // 這一頁玩完一局時。不聽其他分頁的寫入：同步過程本身也會寫入，會讓分頁之間互相觸發、一直重送
  subscribeRuns(() => {
    playedHere = true;
    if (hasUnsyncedRecords() && (loggedIn() || FLAGS.leaderboard)) void syncNow();
  });
  // 登入時沒併成功的訪客剛併進帳號：重新讀帳號紀錄
  subscribeGuestMerged(() => void syncNow());
  window.addEventListener("online", kick);
  // 其他分頁登出（或刪除帳號）：這一頁也當作已登出，再重新讀取登入狀態
  window.addEventListener("storage", (event) => {
    if (event.key !== SIGN_OUT_KEY) return;
    epoch += 1;
    forgetPendingMemory();
    expireSession();
    void refreshMe();
  });
  if (readMe().status === "loggedIn") {
    lastStatus = "loggedIn";
    lastPlayer = currentPlayer();
    void syncNow();
  } else kick();
}

