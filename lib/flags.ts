/**
 * 功能開關。排行榜、累計發車次數的版位都已經做好，
 * 但後端還沒接上，所以預設關閉：正式畫面不顯示假資料，也不放按了沒反應的按鈕。
 * Google 登入已經完成（精準停車的紀錄會跟著帳號走），預設打開；要關掉時設 FEATURE_LOGIN=0（nuxt.config.ts）。
 *
 * 之後功能完成時，把對應的環境變數設成 1 再重新建置就會顯示：
 *   FEATURE_LEADERBOARD、FEATURE_PLAY_COUNT
 * （舊名稱 NEXT_PUBLIC_FEATURE_* 也認得）。值在建置時寫進程式（nuxt.config.ts 的 buildTime）。
 */
export const FLAGS = {
  leaderboard: process.env.FEATURE_LEADERBOARD === "1",
  login: process.env.FEATURE_LOGIN === "1",
  playCount: process.env.FEATURE_PLAY_COUNT === "1",
} as const;

export type FlagName = keyof typeof FLAGS;

/** 開發與測試時可以用 localStorage 的這個 key 暫時打開版位，檢查樣式 */
export const FLAG_OVERRIDE_KEY = "game-station:flags";
