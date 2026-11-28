import { inject } from "vue";
import type { InjectionKey, ShallowRef } from "vue";
import type { MonkSession, Snapshot } from "@/lib/games/monk-soup-tower/session";
import type { Mode } from "@/lib/games/monk-soup-tower/tower";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";

/** 出發區的 id：回到介紹頁時捲到這裡 */
export const BOARD_ID = "tower-board";

export type GameText = Dictionary["monkSoupTower"];

/** 遊戲框內的尺寸單位：設計稿寬 390 px，實際大小跟著遊戲框縮放 */
export const u = (px: number) => `${(px / 3.9).toFixed(3)}cqw`;

/** 介紹頁（出發區、紀錄卡）共用的資料 */
export type ExperienceContext = {
  locale: Locale;
  dict: Dictionary;
  text: GameText;
  /** 開始一局。seed：隨機模式挑戰指定的塔（成績連結的「挑戰同一座塔」） */
  start(mode: Mode, seed?: number | null): void;
};
export const EXPERIENCE: InjectionKey<ExperienceContext> = Symbol("monk-soup-tower-experience");

/** 遊戲畫面共用的資料。snapshot 每一格都會換，只有真的需要逐格更新的元件才直接讀它 */
export type GameContext = {
  session: MonkSession;
  snapshot: Readonly<ShallowRef<Snapshot>>;
  text: GameText;
  locale: Locale;
};
export const GAME: InjectionKey<ShallowRef<GameContext>> = Symbol("monk-soup-tower-game");

export function useExperience(): ExperienceContext {
  const value = inject(EXPERIENCE);
  if (!value) throw new Error("useExperience 必須用在 <MonkSoupTowerExperience> 裡面");
  return value;
}

export function useGame() {
  const value = inject(GAME);
  if (!value) throw new Error("useGame 必須用在 <MonkStage> 裡面");
  return value;
}

/** 秒數顯示：一位小數，小數點依語系（越南文、葡文是逗號）。和成績圖用同一個規則（lib） */
export { secondsText as seconds } from "@/lib/games/monk-soup-tower/scoring";
