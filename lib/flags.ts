/**
 * 功能開關。累計遊玩次數（docs/plans/play-count.md）預設關閉；打開後玩完一局會回報、介紹頁在次數達 100 時顯示。
 * Google 登入（精準停車的紀錄會跟著帳號走）和全站排行（訪客也能上榜）已經完成，預設打開；
 * 要關掉時設 FEATURE_LOGIN=0、FEATURE_LEADERBOARD=0（nuxt.config.ts）。全站排行要登入功能也打開才會出現。
 *
 * 要打開時把環境變數設成 1 再重新建置（正式 D1 要先套 migrations/0007）：
 *   FEATURE_PLAY_COUNT
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
