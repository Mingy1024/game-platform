"use client";

import { useId, useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { Category } from "@/lib/catalog/categories";
import type { GameManifest } from "@/lib/catalog/schema";
import { GameGrid } from "./GameGrid";

type Sort = "newest" | "title";

/**
 * 完整目錄的搜尋、分類與排序。
 * 目前在瀏覽器端篩選；把條件同步到網址 query（供分享）留待後續。
 */
export function CatalogBrowser({
  games,
  categories,
}: {
  games: GameManifest[];
  categories: Category[];
}) {
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("newest");
  const searchId = useId();
  const sortId = useId();

  const results = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    const filtered = games.filter((game) => {
      if (category && !game.categories.includes(category)) return false;
      if (!term) return true;
      return [game.title, game.summary, ...game.tags]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
    if (sort === "title") {
      return [...filtered].sort((a, b) => a.title.localeCompare(b.title, "zh-Hant"));
    }
    return filtered;
  }, [games, keyword, category, sort]);

  const filtering = keyword.trim() !== "" || category !== null;

  function clearFilters() {
    setKeyword("");
    setCategory(null);
  }

  return (
    <div>
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor={searchId} className="mb-1 block font-semibold text-ink">
              搜尋遊戲
            </label>
            <div className="relative">
              <Icon
                name="search"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                id={searchId}
                type="search"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="輸入遊戲名稱或玩法"
                autoComplete="off"
                className="h-12 w-full rounded-xl border border-line bg-platform pl-10 pr-3 text-ink placeholder:text-muted"
              />
            </div>
          </div>
          <div>
            <label htmlFor={sortId} className="mb-1 block font-semibold text-ink">
              排序
            </label>
            <select
              id={sortId}
              value={sort}
              onChange={(event) => setSort(event.target.value as Sort)}
              className="h-12 w-full cursor-pointer rounded-xl border border-line bg-platform px-3 text-ink sm:w-40"
            >
              <option value="newest">最新上線</option>
              <option value="title">名稱</option>
            </select>
          </div>
        </div>

        <fieldset>
          <legend className="mb-1 font-semibold text-ink">分類</legend>
          <div className="flex flex-wrap gap-2">
            <FilterChip selected={category === null} onClick={() => setCategory(null)}>
              全部
            </FilterChip>
            {categories.map((item) => (
              <FilterChip
                key={item.slug}
                selected={category === item.slug}
                onClick={() => setCategory(item.slug)}
              >
                {item.name}
              </FilterChip>
            ))}
          </div>
        </fieldset>
      </div>

      <p className="mb-4 mt-6 text-muted" role="status">
        {filtering ? `符合條件的遊戲共 ${results.length} 款` : `共 ${results.length} 款遊戲`}
      </p>

      {results.length > 0 ? (
        <GameGrid games={results} headingLevel="h2" />
      ) : (
        <div className="rounded-2xl border border-dashed border-line bg-card px-5 py-10 text-center">
          <p className="text-lg font-bold text-ink">找不到符合的遊戲</p>
          <p className="mt-1 text-muted">換個關鍵字，或清除篩選條件看全部遊戲。</p>
          <button
            type="button"
            onClick={clearFilters}
            className="press mt-5 min-h-11 cursor-pointer rounded-full bg-card px-5 font-bold text-sign ring-2 ring-inset ring-sign hover:bg-sign-tint"
          >
            清除篩選條件
          </button>
        </div>
      )}
    </div>
  );
}

function FilterChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-11 cursor-pointer rounded-full px-4 font-semibold transition-colors ${
        selected
          ? "bg-edge text-ink"
          : "bg-platform text-sign ring-1 ring-inset ring-line hover:bg-sign-tint"
      }`}
    >
      {children}
    </button>
  );
}
