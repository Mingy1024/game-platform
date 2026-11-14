import Link from "next/link";
import { AdSlot } from "@/components/ads/AdSlot";
import { CategoryNav } from "@/components/catalog/CategoryNav";
import { GameGrid } from "@/components/catalog/GameGrid";
import { HotTable } from "@/components/catalog/HotTable";
import { StationSign } from "@/components/catalog/StationSign";
import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/layout/PageHeading";
import { ButtonLink } from "@/components/ui/ButtonLink";
import {
  getActiveCategories,
  getFeaturedGame,
  getPublishedGames,
} from "@/lib/catalog/catalog";
import { t } from "@/lib/i18n/zh-TW";

const moreLink =
  "flex min-h-11 items-center font-bold text-sign underline-offset-4 hover:underline";

export default function HomePage() {
  const games = getPublishedGames();
  const featured = getFeaturedGame();
  const others = games.filter((game) => game.slug !== featured?.slug);
  // 站名牌兩側：上一站、下一站各放一款其他遊戲
  const previous = others.at(-1);
  const next = others.length > 1 ? others[0] : undefined;

  return (
    <Container className="py-8 sm:py-12">
      {/* 依標點分段，窄螢幕換行時不會把詞切開 */}
      <h1 className="text-2xl font-extrabold text-sign sm:text-3xl">
        {t.tagline.split(/(?<=[，、])/).map((part) => (
          <span key={part} className="inline-block">
            {part}
          </span>
        ))}
      </h1>
      <p className="mt-2 max-w-xl text-lg text-muted">
        手機、電腦都能玩的小遊戲，一局一兩分鐘。選一款，直接開始。
      </p>

      {featured && (
        <div className="mt-8">
          <StationSign game={featured} previous={previous} next={next} />
        </div>
      )}

      <section aria-labelledby="categories-title" className="mt-14">
        <SectionHeading id="categories-title" title="依分類找遊戲" />
        <CategoryNav categories={getActiveCategories()} />
      </section>

      <section aria-labelledby="latest-title" className="mt-14">
        <SectionHeading
          id="latest-title"
          title="最新遊戲"
          action={
            <Link href="/games" className={moreLink}>
              {t.actions.allGames}
            </Link>
          }
        />
        <GameGrid games={games.slice(0, 6)} />
      </section>

      <AdSlot slot="home-content" className="mt-16" />

      <section aria-labelledby="hot-title" className="mt-16">
        <SectionHeading
          id="hot-title"
          title="熱門榜"
          action={
            <Link href="/hot" className={moreLink}>
              看完整熱門榜
            </Link>
          }
        />
        <HotTable entries={null} caption="熱門遊戲排行" />
      </section>

      <div className="mt-12 text-center">
        <ButtonLink href="/games" variant="secondary" size="lg">
          {t.actions.allGames}
        </ButtonLink>
      </div>
    </Container>
  );
}
