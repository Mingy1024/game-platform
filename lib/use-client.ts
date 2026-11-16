"use client";

import { useCallback, useSyncExternalStore } from "react";

const noop = () => () => {};

/** 是否已經在瀏覽器端接手（伺服器產生的畫面和第一次畫面是 false） */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

/** 媒體查詢是否成立；伺服器端一律是 false */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** 只在瀏覽器端才算得出來的值（例如依使用者時區或裝置能力），伺服器端是 null */
export function useClientValue<T>(read: () => T): T | null {
  return useSyncExternalStore(noop, read, () => null);
}
