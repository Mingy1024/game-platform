import Link from "next/link";

export type Crumb = { label: string; href?: string };

/** 最後一項是目前頁面，不加連結。 */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="麵包屑" className="text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-x-1">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={item.label} className="flex items-center gap-x-1">
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="-mx-1 flex min-h-11 items-center px-1 font-semibold text-sign underline-offset-4 hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined}>{item.label}</span>
              )}
              {!last && <span aria-hidden="true">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
