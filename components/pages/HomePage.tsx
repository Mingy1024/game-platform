import Link from "next/link";
import { AdSlot } from "@/components/ads/AdSlot";
import { CategoryNav } from "@/components/catalog/CategoryNav";
import { GameGrid } from "@/components/catalog/GameGrid";
import { HotTable, withoutStats } from "@/components/catalog/HotTable";
import { StationSign } from "@/components/catalog/StationSign";
import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/layout/PageHeading";
import { ButtonLink } from "@/components/ui/ButtonLink";
import {
  getActiveCategories,
  getFeaturedGame,
  getPublishedGames,
} from "@/lib/catalog/catalog";
import { localizeCategory, localizeGame } from "@/lib/catalog/localize";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";

const moreLink =
  "flex min-h-11 items-center font-bold text-sign underline-offset-4 hover:underline";

/** 首頁。繁體中文和其他語言共用，只差在文字。 */
export function HomePage({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const games = getPublishedGames().map((game) => localizeGame(game, dict));
  const featuredSlug = getFeaturedGame()?.slug;
  const featured = games.find((game) => game.slug === featuredSlug);
  const others = games.filter((game) => game.slug !== featuredSlug);
  // 站名牌兩側：上一站、下一站各放一款其他遊戲
  const previous = others.at(-1);
  const next = others.length > 1 ? others[0] : undefined;
  const categories = getActiveCategories().map((category) => localizeCategory(category, dict));
  const categoryLabels = Object.fromEntries(categories.map((item) => [item.slug, item.name]));

  return (
    <Container className="py-8 sm:py-12">
      {/* 依標點分段，窄螢幕換行時不會把詞切開 */}
      <h1 className="text-2xl font-extrabold text-sign sm:text-3xl">
        {dict.tagline.split(/(?<=[，、,:：])/).map((part) => (
          <span key={part} className="inline-block whitespace-pre-wrap">
            {part}
          </span>
        ))}
      </h1>
      <p className="mt-2 max-w-xl text-lg text-muted">{dict.home.lead}</p>

      {featured && (
        <div className="mt-8">
          <StationSign game={featured} previous={previous} next={next} locale={locale} dict={dict} />
        </div>
      )}

      <section aria-labelledby="categories-title" className="mt-14">
        <SectionHeading id="categories-title" title={dict.home.categoriesTitle} />
        <CategoryNav categories={categories} />
      </section>

      <section aria-labelledby="latest-title" className="mt-14">
        <SectionHeading
          id="latest-title"
          title={dict.home.latestTitle}
          action={
            <Link href="/games" className={moreLink}>
              {dict.actions.allGames}
            </Link>
          }
        />
        <GameGrid games={games.slice(0, 6)} locale={locale} categoryLabels={categoryLabels} />
      </section>

      <AdSlot slot="home-content" className="mt-16" label={dict.ads.label} mockText={dict.ads.mock} />

      <section aria-labelledby="hot-title" className="mt-16">
        <SectionHeading
          id="hot-title"
          title={dict.home.hotTitle}
          action={
            <Link href="/hot" className={moreLink}>
              {dict.home.hotMore}
            </Link>
          }
        />
        <HotTable
          entries={withoutStats(games)}
          caption={dict.home.hotCaption}
          labels={dict.home}
          locale={locale}
          categoryLabels={categoryLabels}
        />
      </section>

      <div className="mt-12 text-center">
        <ButtonLink href="/games" variant="secondary" size="lg">
          {dict.actions.allGames}
        </ButtonLink>
      </div>
    </Container>
  );
}
