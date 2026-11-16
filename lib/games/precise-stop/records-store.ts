"use client";

import { useSyncExternalStore } from "react";
import { emptyRecords, loadRecords, saveRun, type Records, type SaveOutcome } from "./records";
import type { Mode } from "./route";

/**
 * 讓介紹頁和遊戲畫面共用同一份本機紀錄：
 * 一局結束寫入後，介紹頁的看板會立刻顯示新的最佳成績。
 */
const listeners = new Set<() => void>();
const EMPTY = emptyRecords();
let cache: Records | null = null;

function read(): Records {
  if (!cache) cache = loadRecords();
  return cache;
}

function subscribe(listener: () => void) {
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

export function useRecords(): Records {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
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
