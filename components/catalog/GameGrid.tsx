import type { GameManifest } from "@/lib/catalog/schema";
import type { Locale } from "@/lib/i18n/locales";
import { GameCard } from "./GameCard";

/** 遊戲網格：手機 1 欄、平板 2 欄、桌面 3 欄。 */
export function GameGrid({
  games,
  headingLevel,
  locale,
  categoryLabels,
}: {
  games: GameManifest[];
  headingLevel?: "h2" | "h3";
  locale?: Locale;
  categoryLabels?: Record<string, string>;
}) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
      {games.map((game) => (
        <li key={game.id}>
          <GameCard
            game={game}
            headingLevel={headingLevel}
            locale={locale}
            categoryLabels={categoryLabels}
          />
        </li>
      ))}
    </ul>
  );
}
