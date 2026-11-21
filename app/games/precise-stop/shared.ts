import { inject } from "vue";
import type { InjectionKey, ShallowRef } from "vue";
import type { Mode, Route } from "@/lib/games/precise-stop/route";
import type { Judgement } from "@/lib/games/precise-stop/scoring";
import type { GameSession, Snapshot } from "@/lib/games/precise-stop/session";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";

/** 出發看板的 id：換模式回到介紹頁時捲到這裡 */
export const BOARD_ID = "departure-board";

export type GameText = Dictionary["preciseStop"];

/** 遊戲框內的尺寸單位：設計稿寬 420 px，實際大小跟著遊戲框縮放 */
export const u = (px: number) => `${(px / 4.2).toFixed(3)}cqw`;

/** 判定的代表色：綠完美、深藍優秀、灰良好、橘過站 */
export const judgementColor: Record<Judgement, { from: string; to: string; text: string }> = {
  perfect: { from: "#1f9a66", to: "#16794f", text: "#4fd69c" },
  great: { from: "#2f55c4", to: "#1d3a8f", text: "#8fb0ff" },
  good: { from: "#5b6478", to: "#3a4152", text: "#ffffff" },
  fair: { from: "#5b6478", to: "#3a4152", text: "#c9cfd8" },
  miss: { from: "#e0560f", to: "#a83606", text: "#ff8a57" },
};

/**
 * 介紹頁（看板、紀錄卡）共用的資料。一頁一種語言，頁面不會在同一個元件裡換語言，
 * 所以這裡放一般的值。
 */
export type ExperienceContext = {
  locale: Locale;
  dict: Dictionary;
  text: GameText;
  start(mode: Mode): void;
};
export const EXPERIENCE: InjectionKey<ExperienceContext> = Symbol("precise-stop-experience");

/**
 * 遊戲畫面共用的資料。snapshot 每一格畫面都會換，
 * 只有真的需要逐格更新的元件（儀表、距離提示）直接讀它，其他元件只取會變動的那幾個值，
 * 避免整個遊戲畫面每一格都重新渲染。
 */
export type GameContext = {
  session: GameSession;
  route: Route;
  snapshot: Readonly<ShallowRef<Snapshot>>;
  text: GameText;
  locale: Locale;
};
export const GAME: InjectionKey<ShallowRef<GameContext>> = Symbol("precise-stop-game");

export function useExperience(): ExperienceContext {
  const value = inject(EXPERIENCE);
  if (!value) throw new Error("useExperience 必須用在 <PreciseStopExperience> 裡面");
  return value;
}

/** 遊戲畫面裡的元件取得目前這一局 */
export function useGame() {
  const value = inject(GAME);
  if (!value) throw new Error("useGame 必須用在 <GameStage> 裡面");
  return value;
}
