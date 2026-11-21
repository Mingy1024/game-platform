import { emptyRecords, loadRecords, saveRun, type Records, type SaveOutcome } from "./records";
import type { Mode } from "./route";

/**
 * 讓介紹頁和遊戲畫面共用同一份本機紀錄：
 * 一局結束寫入後，介紹頁的看板會立刻顯示新的最佳成績。
 * 純邏輯，只在瀏覽器端呼叫；伺服器端與第一次畫面一律用 EMPTY_RECORDS。
 */
const listeners = new Set<() => void>();
export const EMPTY_RECORDS = emptyRecords();
let cache: Records | null = null;

export function readRecords(): Records {
  if (!cache) cache = loadRecords();
  return cache;
}

export function subscribeRecords(listener: () => void) {
  listeners.add(listener);
  // 其他分頁寫入時也跟著更新
  const onStorage = () => {
    cache = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function recordRun(run: {
  mode: Mode;
  dateKey: string | null;
  total: number;
  perfectStops: number;
}): SaveOutcome {
  const outcome = saveRun(run);
  cache = outcome.records;
  for (const listener of listeners) listener();
  return outcome;
}
