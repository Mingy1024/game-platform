import Link from "next/link";
import type { ReactNode } from "react";

const styles = {
  /** 快車橘：每個畫面只給最重要的一個動作 */
  primary: "bg-express text-white hover:bg-express-deep",
  secondary: "bg-card text-sign ring-2 ring-inset ring-sign hover:bg-sign-tint",
} as const;

const sizes = {
  md: "min-h-11 px-5 text-base",
  lg: "min-h-14 px-8 text-lg",
} as const;

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
}: {
  href: string;
  variant?: keyof typeof styles;
  size?: keyof typeof sizes;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`press inline-flex items-center justify-center gap-2 rounded-full font-bold ${styles[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </Link>
  );
}
