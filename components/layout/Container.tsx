import type { ReactNode } from "react";

/** 全站內容寬度：最大 1200px，兩側至少 16px。 */
export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-[1200px] px-4 sm:px-6 ${className}`}>
      {children}
    </div>
  );
}
