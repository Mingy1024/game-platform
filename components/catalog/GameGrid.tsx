import type { GameManifest } from "@/lib/catalog/schema";
import { GameCard } from "./GameCard";

/** 遊戲網格：手機 1 欄、平板 2 欄、桌面 3 欄。 */
export function GameGrid({
  games,
  headingLevel,
}: {
  games: GameManifest[];
  headingLevel?: "h2" | "h3";
}) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
      {games.map((game) => (
        <li key={game.id}>
          <GameCard game={game} headingLevel={headingLevel} />
        </li>
      ))}
    </ul>
  );
}
