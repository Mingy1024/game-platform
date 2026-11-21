import type { GameManifest } from "./schema";

/** plays 是 null 代表統計還沒啟用：列出遊戲，但名次和次數顯示「—」，不放假數字 */
export type HotEntry = { game: GameManifest; plays: number | null };

/** 統計還沒接上時用：每款遊戲一列，沒有次數 */
export const withoutStats = (games: GameManifest[]): HotEntry[] => games.map((game) => ({ game, plays: null }));
