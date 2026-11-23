import { inject } from "vue";
import type { InjectionKey, ShallowRef } from "vue";
import type { MineSession, Snapshot } from "@/lib/games/mine-descent/session";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";

/** 出發看板的 id：回到介紹頁時捲到這裡 */
export const BOARD_ID = "descent-board";

export type GameText = Dictionary["mineDescent"];

/** 遊戲框內的尺寸單位：設計稿寬 420 px，實際大小跟著遊戲框縮放 */
export const u = (px: number) => `${(px / 4.2).toFixed(3)}cqw`;

/** 介紹頁（出發看板、紀錄卡）共用的資料。一頁一種語言，頁面不會在同一個元件裡換語言 */
export type ExperienceContext = {
  locale: Locale;
  dict: Dictionary;
  text: GameText;
  start(): void;
};
export const EXPERIENCE: InjectionKey<ExperienceContext> = Symbol("mine-descent-experience");

/** 遊戲畫面共用的資料。snapshot 每一格畫面都會換，只有真的需要逐格更新的元件才直接讀它 */
export type GameContext = {
  session: MineSession;
  snapshot: Readonly<ShallowRef<Snapshot>>;
  text: GameText;
  locale: Locale;
};
export const GAME: InjectionKey<ShallowRef<GameContext>> = Symbol("mine-descent-game");

export function useExperience(): ExperienceContext {
  const value = inject(EXPERIENCE);
  if (!value) throw new Error("useExperience 必須用在 <MineDescentExperience> 裡面");
  return value;
}

export function useGame() {
  const value = inject(GAME);
  if (!value) throw new Error("useGame 必須用在 <MineStage> 裡面");
  return value;
}
