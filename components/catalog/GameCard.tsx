import Link from "next/link";
import { categories } from "@/lib/catalog/categories";
import type { GameManifest } from "@/lib/catalog/schema";
import { GameCover } from "./GameCover";

/**
 * 車票卡：左邊是封面（票根），右邊是遊戲資訊，中間有打孔線與缺口。
 * 整張卡是一個連結，焦點外框畫在外層，不會被缺口遮罩切掉。
 */
export function GameCard({
  game,
  headingLevel = "h3",
}: {
  game: GameManifest;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  const categoryNames = categories
    .filter((category) => game.categories.includes(category.slug))
    .map((category) => category.name);

  return (
    <Link href={`/games/${game.slug}`} className="ticket-wrap block h-full rounded-[14px]">
      <article className="ticket flex h-full min-h-32">
        <GameCover game={game} className="h-auto w-28 shrink-0 self-stretch" />
        <div className="flex min-w-0 flex-1 flex-col border-l-2 border-dashed border-line px-4 py-3">
          <Heading className="text-lg font-extrabold text-ink">{game.title}</Heading>
          <p className="mt-0.5 text-sm text-muted">{game.summary}</p>
          <ul className="mt-auto flex flex-wrap gap-1.5 pt-3">
            {categoryNames.map((name) => (
              <li
                key={name}
                className="rounded-full bg-sign-tint px-2.5 py-0.5 text-sm font-semibold text-sign"
              >
                {name}
              </li>
            ))}
            {game.tags.slice(0, 1).map((tag) => (
              <li
                key={tag}
                className="rounded-full px-2.5 py-0.5 text-sm text-muted ring-1 ring-inset ring-line"
              >
                {tag}
              </li>
            ))}
          </ul>
        </div>
      </article>
    </Link>
  );
}
