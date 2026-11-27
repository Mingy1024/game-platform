import { randomId } from "@/lib/account/crypto";
import { FLAGS } from "@/lib/flags";

/**
 * 前端：回報玩完一局、讀取總數（docs/plans/play-count.md）。
 *
 * 回報的結果表（docs/dev/sync-checklist.md 第 2 節）：每局只送一次、帶這一局的代碼，任何失敗都不重送
 * （離線、逾時、403、429、5xx 都一樣：這一局不計入，接受少算）。伺服器已經寫入但回應沒收到時，
 * 因為不重送所以不會多加；就算網路層自己重送，同一個代碼伺服器也只加一次。
 * 不看登入、不存在瀏覽器，所以登出、換帳號、多分頁都沒有影響。
 */

const url = (slug: string) => `/api/play-count/${encodeURIComponent(slug)}`;

/** 玩完一局時呼叫一次。功能關閉時不送。 */
export function reportPlay(slug: string, enabled = FLAGS.playCount): void {
  if (!enabled || typeof fetch !== "function") return;
  void fetch(url(slug), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    // 玩完馬上離開頁面也盡量送到
    keepalive: true,
    body: JSON.stringify({ runId: randomId(24) }),
  }).catch(() => undefined);
}

/** 讀取總數；失敗或格式不對回 null（介紹頁就不顯示） */
export async function fetchPlayCount(slug: string): Promise<number | null> {
  try {
    const response = await fetch(url(slug), { credentials: "same-origin" });
    if (!response.ok) return null;
    const body = (await response.json()) as { count?: unknown };
    return typeof body.count === "number" && Number.isInteger(body.count) && body.count >= 0 ? body.count : null;
  } catch {
    return null;
  }
}
