import type { Player } from "@/lib/account/player";
import { guestInfo } from "@/lib/account/player";
import { createGuest, findGuestBySyncId, reissueGuest, touchGuestPlayed } from "@/lib/account/guest";
import { FLAGS } from "@/lib/flags";
import { MAX_SYNC_BODY_BYTES, parseSyncBody } from "@/lib/games/precise-stop/account-records";

/**
 * 把本機紀錄併進帳號或訪客（帳號設計稿第 11.2 節，P4–P6；精準停車設計稿第 14.3 節，T8–T11、T13、T14）。
 *   { syncId, playerId, bests: [{ mode, dateKey, score, achievedAt }], perfectDelta, consent? }
 * 回傳合併後的紀錄（格式同 GET）；送到訪客時另外帶 guest: { playerId, nick }。
 *
 * 身分：
 * - Google 登入：playerId 要是這個帳號。帶著訪客 cookie 時先把訪客併進帳號（併失敗回 503，不先寫進帳號：
 *   不然之後再併時，訪客累計的完美次數會把這一批再加一次）
 * - 訪客（gs_guest）：playerId 是這個訪客，或 null（這一頁還不知道已經有訪客，例如建立時的回應掉了但 cookie 收到了）
 * - 都沒有、而且 playerId 是 null：建立訪客（排行榜打開時）。同一個 syncId 找得到剛建立的訪客就補發 cookie、不再建立（T9）；
 *   歐盟地區沒帶 consent 回 403 consent_required（T11）；同一個 IP 每分鐘超過 3 個回 429（T10）
 *
 * 錯誤：400 bad_request（格式或分數範圍不對，整批不收）、401（沒有身分、或 playerId 不是 null 卻沒有對應的身分）、
 * 403 origin／consent_required、409 account_mismatch（playerId 和目前身分不同，什麼都不寫）、411／413、429 rate、503 unavailable。
 */
export default defineEventHandler((event) =>
  guarded(event, async () => {
    const db = useDb(event);
    const google = await googlePlayer(event, db);
    if (google && FLAGS.leaderboard && !(await absorbGuest(event, db, google.id))) return jsonError(event, 503, "unavailable");
    const guest = !google && FLAGS.leaderboard ? await guestPlayer(event, db) : null;
    const known = google ?? guest;

    // 已經有身分：先限流再讀內容（無效的請求也算次數）
    if (known) {
      const rate = await checkRateLimit(event, "RECORDS_LIMITER", known.id);
      if (rate === "limited") return jsonError(event, 429, "rate");
      if (rate === "unavailable") return jsonError(event, 503, "unavailable");
    }

    const read = await readJsonBody(event, MAX_SYNC_BODY_BYTES);
    if (typeof read === "number") return jsonError(event, read, "bad_request");
    const raw = read.body as { playerId?: unknown } | null;
    // 沒有身分、又不是要建立訪客：和以前一樣當作沒登入
    if (!known && (!FLAGS.leaderboard || raw?.playerId !== null)) return jsonError(event, 401, "unauthorized");

    const now = Date.now();
    const body = parseSyncBody(read.body, now);
    if (!body) return jsonError(event, 400, "bad_request");

    let target: Player;
    if (google) {
      if (body.playerId !== google.id) return jsonError(event, 409, "account_mismatch");
      target = google;
    } else if (guest) {
      if (body.playerId !== null && body.playerId !== guest.id) return jsonError(event, 409, "account_mismatch");
      target = guest;
    } else {
      const created = await guestFor(event, body.syncId, body.consent === true);
      if (typeof created === "number") {
        return jsonError(event, created, created === 403 ? "consent_required" : created === 429 ? "rate" : "unavailable");
      }
      setGuestCookie(event, created.token, created.expiresAt);
      target = created.player;
    }

    await applySync(db, target.id, body, now);
    if (target.kind === "guest") await touchGuestPlayed(db, target.id, new Date(now));
    const records = await readAccountRecords(db, target.id, now);
    return noStore(event, target.kind === "guest" ? { ...records, guest: guestInfo(target) } : records);
  }),
);

/** 建立訪客（或找回同一個 syncId 建立的那一個）。不能建立時回傳狀態碼 */
async function guestFor(event: Parameters<typeof useDb>[0], syncId: string, consent: boolean) {
  const db = useDb(event);
  if (consentRequired(event) && !consent) return 403 as const;
  const existing = await findGuestBySyncId(db, syncId);
  if (existing) return reissueGuest(db, existing);
  const rate = await checkRateLimit(event, "GUEST_LIMITER", clientIp(event));
  if (rate === "limited") return 429 as const;
  if (rate === "unavailable") return 503 as const;
  return createGuest(db, syncId);
}
