import { categories, type Category } from "./categories";
import { gameManifestSchema, type GameManifest } from "./schema";

/**
 * 遊戲目錄。新增遊戲時在這裡加一筆 manifest；
 * 模組載入時會以 schema 驗證，格式錯誤會直接讓 build 失敗。
 *
 * 目前三款遊戲的玩法程式尚未實作（version 0.1.0），
 * 這份資料先用來建立各頁面的畫面外框。
 */
const manifests: GameManifest[] = [
  {
    id: "game-tap-targets",
    slug: "tap-targets",
    title: "反應點點",
    summary: "30 秒內，圓點出現就點下去。",
    categories: ["reflex", "casual"],
    tags: ["30 秒一局", "單指可玩"],
    cover: "/games/tap-targets/0.1.0/cover.svg",
    contentPath: "content/games/tap-targets.md",
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
  {
    id: "game-lane-dodge",
    slug: "lane-dodge",
    title: "三線閃避",
    summary: "三條車道，左右切換閃過障礙，撐滿 60 秒。",
    categories: ["racing", "reflex"],
    tags: ["60 秒一局", "左右兩鍵"],
    cover: "/games/lane-dodge/0.1.0/cover.svg",
    contentPath: "content/games/lane-dodge.md",
    status: "published",
    publishedAt: "2026-11-15T00:00:00+08:00",
    updatedAt: "2026-11-15T00:00:00+08:00",
    version: "0.1.0",
    scoringVersion: "1",
    engine: "phaser",
    orientation: "portrait",
    inputs: ["touch", "keyboard"],
    aspectRatio: 3 / 4,
    featured: false,
    scoreOrder: "desc",
    scoreUnit: "分",
  },
  {
    id: "game-memory-pairs",
    slug: "memory-pairs",
    title: "記憶配對",
    summary: "16 張牌、8 組圖案，翻出所有配對，越快越好。",
    categories: ["puzzle", "casual"],
    tags: ["4×4", "比時間"],
    cover: "/games/memory-pairs/0.1.0/cover.svg",
    contentPath: "content/games/memory-pairs.md",
    status: "published",
    publishedAt: "2026-11-15T00:00:00+08:00",
    updatedAt: "2026-11-15T00:00:00+08:00",
    version: "0.1.0",
    scoringVersion: "1",
    engine: "dom",
    orientation: "any",
    inputs: ["touch", "mouse", "keyboard"],
    aspectRatio: 1,
    featured: false,
    scoreOrder: "asc",
    scoreUnit: "秒",
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
