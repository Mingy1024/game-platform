import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdSlot } from "@/components/ads/AdSlot";
import { GameGrid } from "@/components/catalog/GameGrid";
import { BestRecord } from "@/components/game/BestRecord";
import { GameShellPlaceholder } from "@/components/game/GameShellPlaceholder";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/layout/PageHeading";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Icon } from "@/components/ui/Icon";
import {
  getCategoriesOfGame,
  getGameBySlug,
  getPublishedGames,
  getRelatedGames,
} from "@/lib/catalog/catalog";
import { getGameGuide } from "@/lib/catalog/guides";
import { t } from "@/lib/i18n/zh-TW";

export function generateStaticParams() {
  return getPublishedGames().map((game) => ({ slug: game.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/games/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const game = getGameBySlug(slug);
  if (!game) return {};
  return {
    title: game.title,
    description: game.summary,
    alternates: { canonical: `/games/${game.slug}` },
    openGraph: { title: game.title, description: game.summary, images: [game.cover] },
  };
}

export default async function GamePage({ params }: PageProps<"/games/[slug]">) {
  const { slug } = await params;
  const game = getGameBySlug(slug);
  // 不存在的 slug 回傳真正的 404，不顯示泛用模板
  if (!game) notFound();

  const guide = getGameGuide(game.slug);
  const gameCategories = getCategoriesOfGame(game);
  const related = getRelatedGames(game);

  return (
    <Container className="py-6 sm:py-10">
      <Breadcrumb
        items={[
          { label: "首頁", href: "/" },
          { label: "全部遊戲", href: "/games" },
          { label: game.title },
        ]}
      />

      <header className="mt-2">
        <h1 className="text-2xl font-extrabold text-sign sm:text-3xl">{game.title}</h1>
        <p className="mt-2 text-lg text-muted">{game.summary}</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {gameCategories.map((category) => (
            <li key={category.slug}>
              <Link
                href={`/categories/${category.slug}`}
                className="flex min-h-11 items-center rounded-full bg-sign-tint px-4 font-semibold text-sign hover:bg-edge-tint"
              >
                {category.name}
              </Link>
            </li>
          ))}
        </ul>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <GameShellPlaceholder game={game} />

        <div className="space-y-4">
          {guide && (
            <section
              aria-labelledby="controls-title"
              className="rounded-2xl border border-line bg-card p-5"
            >
              <h2 id="controls-title" className="text-lg font-extrabold text-ink">
                操作方式
              </h2>
              <dl className="mt-3 space-y-3">
                <div className="flex gap-3">
                  <Icon name="touch" size={24} className="mt-0.5 shrink-0 text-sign" />
                  <div>
                    <dt className="font-bold text-ink">手機</dt>
                    <dd className="text-muted">{guide.controls.touch}</dd>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Icon name="keyboard" size={24} className="mt-0.5 shrink-0 text-sign" />
                  <div>
                    <dt className="font-bold text-ink">電腦</dt>
                    <dd className="text-muted">{guide.controls.desktop}</dd>
                  </div>
                </div>
              </dl>
            </section>
          )}
          <BestRecord game={game} />
        </div>
      </div>

      {guide && (
        <div className="mt-16 max-w-2xl space-y-10">
          <section aria-labelledby="howto-title">
            <SectionHeading id="howto-title" title="怎麼玩" />
            <ul className="list-disc space-y-2 pl-6">
              {guide.howTo.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="scoring-title">
            <SectionHeading id="scoring-title" title="計分方式" />
            <p>{guide.scoring}</p>
          </section>

          <section aria-labelledby="faq-title">
            <SectionHeading id="faq-title" title="常見問題" />
            <dl className="space-y-5">
              {guide.faq.map((item) => (
                <div key={item.question}>
                  <dt className="font-bold text-ink">{item.question}</dt>
                  <dd className="mt-1 text-muted">{item.answer}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      )}

      {/* 廣告放在玩法內容之後，與遊戲操作區保持足夠距離 */}
      <AdSlot slot="game-guide" className="mt-16" />

      {related.length > 0 && (
        <section aria-labelledby="related-title" className="mt-16">
          <SectionHeading id="related-title" title="再玩一款" />
          <GameGrid games={related} />
        </section>
      )}

      {guide && (
        <section aria-labelledby="changelog-title" className="mt-16 max-w-2xl">
          <SectionHeading id="changelog-title" title="更新紀錄" />
          <ul className="space-y-2">
            {guide.changelog.map((entry) => (
              <li key={entry.date + entry.note} className="flex flex-wrap gap-x-4">
                <time dateTime={entry.date} className="font-bold tabular-nums text-ink">
                  {entry.date}
                </time>
                <span className="text-muted">{entry.note}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-12">
        <ButtonLink href="/games" variant="secondary">
          {t.actions.backToGames}
        </ButtonLink>
      </div>
    </Container>
  );
}
