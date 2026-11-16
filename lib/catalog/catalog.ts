import { categories, type Category } from "./categories";
import { gameManifestSchema, type GameManifest } from "./schema";

/**
 * 遊戲目錄。新增遊戲時在這裡加一筆 manifest；
 * 模組載入時會以 schema 驗證，格式錯誤會直接讓 build 失敗。
 *
 * title、summary、tags 是繁體中文的預設文字；有翻譯的遊戲在 lib/catalog/localize.ts 取各語言的版本。
 */
const manifests: GameManifest[] = [
  {
    id: "game-precise-stop",
    slug: "precise-stop",
    title: "精準停車",
    summary: "按住煞車、放開滑行，讓列車停進目標區。",
    categories: ["reflex", "casual"],
    tags: ["一局 5 站", "單指可玩"],
    cover: "/games/precise-stop/0.1.0/cover.webp",
    contentPath: "lib/i18n/dictionaries",
    status: "published",
    publishedAt: "2026-11-15T00:00:00+08:00",
    updatedAt: "2026-11-15T00:00:00+08:00",
    version: "0.1.0",
    scoringVersion: "1",
    engine: "phaser",
    orientation: "portrait",
    inputs: ["touch", "mouse", "keyboard"],
    aspectRatio: 3 / 4,
    featured: true,
    scoreOrder: "desc",
    scoreUnit: "分",
  },
];

const catalog: GameManifest[] = gameManifestSchema.array().parse(manifests);

const slugs = new Set<string>();
for (const game of catalog) {
  if (slugs.has(game.slug)) {
    throw new Error(`遊戲目錄有重複的 slug：${game.slug}`);
  }
  slugs.add(game.slug);
  for (const category of game.categories) {
    if (!categories.some((item) => item.slug === category)) {
      throw new Error(`遊戲 ${game.slug} 使用了不存在的分類：${category}`);
    }
  }
}

/** 已發布的遊戲，新的排前面。draft／archived 不外露。 */
export function getPublishedGames(): GameManifest[] {
  return catalog
    .filter((game) => game.status === "published")
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function getGameBySlug(slug: string): GameManifest | undefined {
  return getPublishedGames().find((game) => game.slug === slug);
}

export function getGamesByCategory(categorySlug: string): GameManifest[] {
  return getPublishedGames().filter((game) =>
    game.categories.includes(categorySlug),
  );
}

export function getFeaturedGame(): GameManifest | undefined {
  const games = getPublishedGames();
  return games.find((game) => game.featured) ?? games[0];
}

/** 同分類的其他遊戲；不足時用其餘遊戲補上。 */
export function getRelatedGames(game: GameManifest, limit = 3): GameManifest[] {
  const others = getPublishedGames().filter((item) => item.slug !== game.slug);
  const sameCategory = others.filter((item) =>
    item.categories.some((category) => game.categories.includes(category)),
  );
  const rest = others.filter((item) => !sameCategory.includes(item));
  return [...sameCategory, ...rest].slice(0, limit);
}

export function getCategoriesOfGame(game: GameManifest): Category[] {
  return categories.filter((category) =>
    game.categories.includes(category.slug),
  );
}

/** 有已發布遊戲的分類才顯示入口，不建立空分類頁。 */
export function getActiveCategories(): Category[] {
  return categories.filter(
    (category) => getGamesByCategory(category.slug).length > 0,
  );
}
