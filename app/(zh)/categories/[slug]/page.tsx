import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryNav } from "@/components/catalog/CategoryNav";
import { GameGrid } from "@/components/catalog/GameGrid";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Container } from "@/components/layout/Container";
import { PageHeading, SectionHeading } from "@/components/layout/PageHeading";
import { getActiveCategories, getGamesByCategory } from "@/lib/catalog/catalog";
import { getCategoryBySlug } from "@/lib/catalog/categories";

export function generateStaticParams() {
  return getActiveCategories().map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/categories/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);
  if (!category) return {};
  return {
    title: `${category.name}遊戲`,
    description: category.intro,
    alternates: { canonical: `/categories/${category.slug}` },
  };
}

export default async function CategoryPage({
  params,
}: PageProps<"/categories/[slug]">) {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);
  const games = category ? getGamesByCategory(category.slug) : [];
  // 不存在或沒有遊戲的分類都回 404，不建立空分類頁
  if (!category || games.length === 0) notFound();

  return (
    <Container className="py-6 sm:py-10">
      <Breadcrumb
        items={[
          { label: "首頁", href: "/" },
          { label: "全部遊戲", href: "/games" },
          { label: category.name },
        ]}
      />
      <div className="mt-2">
        <PageHeading title={`${category.name}遊戲`} lead={category.intro} />
      </div>

      <div className="mt-8">
        <GameGrid games={games} headingLevel="h2" />
      </div>

      <section aria-labelledby="other-categories-title" className="mt-16">
        <SectionHeading id="other-categories-title" title="其他分類" />
        <CategoryNav categories={getActiveCategories()} currentSlug={category.slug} />
      </section>
    </Container>
  );
}
