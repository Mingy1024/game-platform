import { startAccountSync as startEscapeSync } from "@/lib/games/office-escape/account-sync";
import { startAccountSync } from "@/lib/games/precise-stop/account-sync";

/**
 * 啟動各款遊戲紀錄的帳號同步（lib/games/<遊戲>/account-sync.ts）。
 * 接手完成後才開始：同步回來會換掉本機紀錄，接手前改的話畫面會和伺服器產生的不一致。
 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook("app:suspense:resolve", () => {
    startAccountSync();
    startEscapeSync();
  });
});
