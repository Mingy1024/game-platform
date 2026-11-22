import { LINES_TOTAL } from "./config";
import { getStore, type Store } from "./records";

/**
 * 台詞庫：看過的台詞記在本機（"pool:line"），結算顯示「本局新看到 N 句」（D6）。
 * 只存在這台裝置，不上傳；瀏覽器不允許儲存時照常能玩，只是每局都算新看到的。
 */
export const SEEN_KEY = "game-station:office-escape:seen:v1";
const POOLS = ["coworker", "boss", "group"] as const;
const VALID = new RegExp(`^(${POOLS.join("|")}):\\d{1,2}$`);

export function loadSeen(store: Store | null = getStore()): string[] {
  try {
    const raw = store?.getItem(SEEN_KEY);
    const data = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(data) ? [...new Set(data.filter((item): item is string => typeof item === "string" && VALID.test(item)))] : [];
  } catch {
    return [];
  }
}

export const seenCount = (store: Store | null = getStore()) => Math.min(LINES_TOTAL, loadSeen(store).length);

/** 記下這局看到的台詞，回傳這局新看到幾句 */
export function recordSeen(keys: string[], store: Store | null = getStore()): number {
  const seen = new Set(loadSeen(store));
  const added = keys.filter((key) => VALID.test(key) && !seen.has(key));
  for (const key of added) seen.add(key);
  try {
    if (added.length > 0) store?.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    // 不能儲存時只是下一局還會算新的
  }
  return new Set(added).size;
}
