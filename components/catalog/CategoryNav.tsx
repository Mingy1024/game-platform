import Link from "next/link";
import type { Category } from "@/lib/catalog/categories";

/** 分類入口：每個分類一塊站牌樣式的連結。 */
export function CategoryNav({
  categories,
  currentSlug,
}: {
  categories: Category[];
  currentSlug?: string;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {categories.map((category) => {
        const current = category.slug === currentSlug;
        return (
          <li key={category.slug}>
            <Link
              href={`/categories/${category.slug}`}
              aria-current={current ? "page" : undefined}
              className={`press flex h-full min-h-20 flex-col justify-center rounded-xl border-l-8 px-4 py-3 ${
                current
                  ? "border-edge bg-edge-tint"
                  : "border-sign bg-card ring-1 ring-inset ring-line hover:bg-sign-tint"
              }`}
            >
              <span className="text-lg font-extrabold text-ink">{category.name}</span>
              <span className="text-sm text-muted">{category.summary}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
