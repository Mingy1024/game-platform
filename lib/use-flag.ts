"use client";

import { useSyncExternalStore } from "react";
import { FLAG_OVERRIDE_KEY, FLAGS, type FlagName } from "./flags";

const subscribe = () => () => {};

function readOverride(name: FlagName): boolean {
  if (process.env.NODE_ENV === "production") return false;
  try {
    const raw = window.localStorage.getItem(FLAG_OVERRIDE_KEY);
    return raw ? raw.split(",").includes(name) : false;
  } catch {
    return false;
  }
}

/** 預留功能是否顯示。伺服器端和第一次畫面一律用環境變數的值，避免畫面不一致。 */
export function useFlag(name: FlagName): boolean {
  return useSyncExternalStore(
    subscribe,
    () => FLAGS[name] || readOverride(name),
    () => FLAGS[name],
  );
}
