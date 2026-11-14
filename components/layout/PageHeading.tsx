import type { ReactNode } from "react";

/** 內頁標題區：h1 加一段簡短說明。 */
export function PageHeading({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children?: ReactNode;
}) {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-extrabold text-sign sm:text-3xl">{title}</h1>
      {lead && <p className="mt-3 text-lg text-muted">{lead}</p>}
      {children}
    </div>
  );
}

/** 區塊標題：h2，右側可放一個「看更多」連結。 */
export function SectionHeading({
  id,
  title,
  action,
}: {
  id?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <h2 id={id} className="text-xl font-extrabold text-ink sm:text-2xl">
        {title}
      </h2>
      {action}
    </div>
  );
}
