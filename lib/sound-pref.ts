"use client";

import { useSyncExternalStore } from "react";

/**
 * 全站共用的靜音設定。預設有聲音；玩家的選擇記在本機，
 * 瀏覽器不允許儲存時只記在這次瀏覽（照常有聲）。
 */
const KEY = "gp:muted";
const listeners = new Set<() => void>();
let memory: boolean | null = null;

export function readMuted(): boolean {
  if (memory !== null) return memory;
  try {
    memory = window.localStorage.getItem(KEY) === "1";
  } catch {
    memory = false;
  }
  return memory;
}

export function setMuted(muted: boolean): void {
  memory = muted;
  try {
    window.localStorage.setItem(KEY, muted ? "1" : "0");
  } catch {
    // 不能儲存時只在這次瀏覽有效
  }
  for (const listener of listeners) listener();
}

export function subscribeMuted(listener: () => void): () => void {
  listeners.add(listener);
  // 其他分頁切換靜音時也跟著更新
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    memory = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useMuted(): boolean {
  return useSyncExternalStore(subscribeMuted, readMuted, () => false);
}
