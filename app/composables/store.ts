import type { ShallowRef } from "vue";
import { retryAccountSync as retryMineSync } from "@/lib/games/mine-descent/account-sync";
import { EMPTY_RECORDS as EMPTY_MINE_RECORDS, readRecords as readMineRecords, subscribeRecords as subscribeMineRecords } from "@/lib/games/mine-descent/records-store";
import type { Records as MineRecords } from "@/lib/games/mine-descent/records";
import { retryAccountSync as retryEscapeSync } from "@/lib/games/office-escape/account-sync";
import { EMPTY_RECORDS as EMPTY_ESCAPE_RECORDS, readRecords as readEscapeRecords, subscribeRecords as subscribeEscapeRecords } from "@/lib/games/office-escape/records-store";
import type { Records as EscapeRecords } from "@/lib/games/office-escape/records";
import { retryAccountSync } from "@/lib/games/precise-stop/account-sync";
import { EMPTY_RECORDS, readRecords, subscribeRecords } from "@/lib/games/precise-stop/records-store";
import type { Records } from "@/lib/games/precise-stop/records";
import { FLAG_OVERRIDE_KEY, FLAGS, type FlagName } from "@/lib/flags";
import type { Pref } from "@/lib/sound-pref";

/**
 * 讀取只有瀏覽器才知道的值（本機紀錄、聲音設定、時區、裝置能力）。
 * 伺服器產生的畫面和接手（hydration）時一律用 serverValue，接手後才換成實際的值，
 * 這樣兩邊畫面一致；之後在站內換頁時直接用實際的值。
 */
export function useExternalStore<T>(
  subscribe: (listener: () => void) => () => void,
  read: () => T,
  serverValue: T,
): Readonly<ShallowRef<T>> {
  const nuxtApp = useNuxtApp();
  const value = shallowRef<T>(import.meta.client && !nuxtApp.isHydrating ? read() : serverValue);
  let stop: (() => void) | undefined;
  onMounted(() => {
    value.value = read();
    stop = subscribe(() => {
      value.value = read();
    });
  });
  onBeforeUnmount(() => stop?.());
  return value;
}

const noSubscribe = () => () => {};

/** 只在瀏覽器端才算得出來的值，伺服器端是 null */
export function useClientValue<T>(read: () => T) {
  return useExternalStore<T | null>(noSubscribe, read, null);
}

/** 是否已經在瀏覽器端接手 */
export function useHydrated() {
  return useClientValue(() => true);
}

/** 媒體查詢是否成立；伺服器端一律是 false */
export function useMediaQuery(query: string) {
  return useExternalStore(
    (notify) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    false,
  );
}

/** 聲音設定（lib/sound-pref.ts） */
export function usePref(pref: Pref) {
  return useExternalStore(pref.subscribe, pref.read, false);
}

/** 精準停車的本機紀錄（登入時是帳號的紀錄）。掛上時順便重送還沒存到帳號的部分 */
export function useRecords() {
  onMounted(retryAccountSync);
  return useExternalStore<Records>(subscribeRecords, readRecords, EMPTY_RECORDS);
}

/** 下班逃離辦公室的本機紀錄（登入時是帳號的紀錄）。掛上時順便重送還沒存到帳號的部分 */
export function useEscapeRecords() {
  onMounted(retryEscapeSync);
  return useExternalStore<EscapeRecords>(subscribeEscapeRecords, readEscapeRecords, EMPTY_ESCAPE_RECORDS);
}

/** 一路向下的本機紀錄（登入時是帳號的紀錄）。掛上時順便重送還沒存到帳號的部分 */
export function useMineRecords() {
  onMounted(retryMineSync);
  return useExternalStore<MineRecords>(subscribeMineRecords, readMineRecords, EMPTY_MINE_RECORDS);
}

/** 開發版可以用 localStorage 暫時打開版位（正式版一律不看） */
function readFlagOverride(name: FlagName): boolean {
  if (!import.meta.dev) return false;
  try {
    const raw = window.localStorage.getItem(FLAG_OVERRIDE_KEY);
    return raw ? raw.split(",").includes(name) : false;
  } catch {
    return false;
  }
}

/** 預留功能是否顯示。伺服器端和第一次畫面一律用建置時的值，避免畫面不一致。 */
export function useFlag(name: FlagName) {
  return useExternalStore(noSubscribe, () => FLAGS[name] || readFlagOverride(name), FLAGS[name]);
}
