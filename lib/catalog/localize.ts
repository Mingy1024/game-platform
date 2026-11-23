import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Category } from "./categories";
import type { GameManifest } from "./schema";

/** 目錄資料的顯示文字：有翻譯就用該語言的，沒有就用 manifest 裡的繁體中文 */
export function localizeGame(game: GameManifest, dict: Dictionary): GameManifest {
  if (game.slug === "precise-stop") {
    const text = dict.preciseStop;
    return { ...game, title: text.title, summary: text.summary, tags: [...text.tags] };
  }
  if (game.slug === "office-escape") {
    const text = dict.officeEscape;
    return { ...game, title: text.title, summary: text.summary, tags: [...text.tags] };
  }
  if (game.slug === "mine-descent") {
    const text = dict.mineDescent;
    return { ...game, title: text.title, summary: text.summary, tags: [...text.tags] };
  }
  return game;
}

export function localizeCategory(category: Category, dict: Dictionary): Category {
  const text = (dict.categories as Record<string, { name: string; summary: string } | undefined>)[
    category.slug
  ];
  return text ? { ...category, name: text.name, summary: text.summary } : category;
}
