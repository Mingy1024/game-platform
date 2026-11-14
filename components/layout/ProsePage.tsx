import type { ReactNode } from "react";
import { Container } from "./Container";
import { PageHeading } from "./PageHeading";

/** 關於、政策、聯絡等文章頁的共用版型。 */
export function ProsePage({
  title,
  lead,
  draft = false,
  children,
}: {
  title: string;
  lead?: string;
  /** 內容尚未定稿時顯示提示 */
  draft?: boolean;
  children: ReactNode;
}) {
  return (
    <Container className="py-10 sm:py-14">
      <PageHeading title={title} lead={lead} />
      {draft && (
        <p className="mt-6 max-w-2xl rounded-xl border border-edge bg-edge-tint px-4 py-3 text-ink">
          這一頁是暫定內容。網站正式上線前，會依實際使用的服務與聯絡方式改寫。
        </p>
      )}
      <div className="prose-page mt-8 max-w-2xl space-y-8">{children}</div>
    </Container>
  );
}

export function ProseSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xl font-extrabold text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-ink">{children}</div>
    </section>
  );
}
