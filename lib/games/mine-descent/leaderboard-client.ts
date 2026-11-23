import { withTimeout } from "@/lib/account/me-store";
import { parseMine, parseTop, type MineResponse, type Scope, type TopResponse } from "./leaderboard";
import type { Records } from "./records";

/**
 * 全站排行的讀取。只在瀏覽器端呼叫。
 * - 前 100 名：讀不到或格式不對都回傳 null，畫面顯示「暫時讀不到排行」和「再試一次」，不自動重試（T7）
 * - 自己的名次：讀不到回傳 null（那一列只顯示自己的最佳分）；409（身分換了）回傳 "mismatch"，呼叫的地方重新讀登入狀態
 */
const API = "/api/games/mine-descent/leaderboard";

export async function fetchTop(scope: Scope): Promise<TopResponse | null> {
  const response = await fetch(`${API}?scope=${scope}`, withTimeout({ credentials: "same-origin" })).catch(() => null);
  if (!response?.ok) return null;
  const body = parseTop(await response.json().catch(() => null));
  return body && body.scope === scope ? body : null;
}

export async function fetchMine(scope: Scope, playerId: string): Promise<MineResponse | "mismatch" | null> {
  const response = await fetch(
    `${API}/me?scope=${scope}&player=${encodeURIComponent(playerId)}`,
    withTimeout({ cache: "no-store", credentials: "same-origin" }),
  ).catch(() => null);
  if (response?.status === 409) return "mismatch";
  if (!response?.ok) return null;
  return parseMine(await response.json().catch(() => null));
}

/** 讀不到名次時顯示的「自己的最佳」：用本機（登入時是帳號）的紀錄算 */
export const localBest = (records: Records, scope: Scope): number | null => records[scope];
