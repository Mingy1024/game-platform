/**
 * 歐盟地區（歐洲經濟區、英國、瑞士）的上榜選擇（精準停車設計稿第 37 題，T11）。
 * 只由使用者動作寫入：結算的「上榜／不要」、排行榜「改成上榜」、我的紀錄頁的開關。覆蓋寫入，不會同時寫。
 * 存在本機 game-station:leaderboard-consent，所有分頁一致（storage 事件）；不能儲存時記在這一頁的記憶體。
 * 純邏輯，只在瀏覽器端呼叫。
 */
export type Consent = "yes" | "no" | null;

export const CONSENT_KEY = "game-station:leaderboard-consent";
const listeners = new Set<() => void>();
let memory: Consent = null;

function store(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readConsent(): Consent {
  try {
    const value = store()?.getItem(CONSENT_KEY);
    if (value === "yes" || value === "no") return value;
    if (value === null || value === undefined) return memory;
  } catch {
    // 讀不到就用記憶體那份
  }
  return memory;
}

export function writeConsent(value: Exclude<Consent, null>) {
  memory = value;
  try {
    store()?.setItem(CONSENT_KEY, value);
  } catch {
    // 不能儲存時只記在這一頁
  }
  for (const listener of listeners) listener();
}

export function subscribeConsent(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === CONSENT_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
