import { ensureMe, readMe, SERVER_ME, subscribeMe } from "@/lib/account/me-store";

/** 前端的登入狀態（lib/account/me-store.ts）：第一次有元件用到時才向 /api/me 要資料 */
export function useMe() {
  onMounted(ensureMe);
  return useExternalStore(subscribeMe, readMe, SERVER_ME);
}
