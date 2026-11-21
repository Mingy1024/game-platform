import { MAX_SYNC_BODY_BYTES, parseSyncBody } from "@/lib/games/precise-stop/account-records";

/**
 * 把本機紀錄併進帳號（帳號設計稿第 11.2 節，P4–P6）。
 *   { syncId, playerId, bests: [{ mode, dateKey, score, achievedAt }], perfectDelta }
 * 回傳合併後的帳號紀錄（格式同 GET）。
 * 錯誤：400 bad_request（格式或分數範圍不對，整批不收）、401、403 origin、
 * 409 account_mismatch（playerId 不是目前登入的帳號：另一個分頁換了帳號，什麼都不寫）、411／413、429 rate、503 unavailable。
 */
export default defineEventHandler((event) =>
  guarded(event, async () => {
    const db = useDb(event);
    const player = await requireSessionPlayer(event, db);

    // 先限流再讀內容：無效的請求也算次數
    const rate = await checkRateLimit(event, "RECORDS_LIMITER", player.id);
    if (rate === "limited") return jsonError(event, 429, "rate");
    if (rate === "unavailable") return jsonError(event, 503, "unavailable");

    const read = await readJsonBody(event, MAX_SYNC_BODY_BYTES);
    if (typeof read === "number") return jsonError(event, read, "bad_request");
    const now = Date.now();
    const body = parseSyncBody(read.body, now);
    if (!body) return jsonError(event, 400, "bad_request");
    if (body.playerId !== player.id) return jsonError(event, 409, "account_mismatch");

    await applySync(db, player.id, body, now);
    return noStore(event, await readAccountRecords(db, player.id, now));
  }),
);
