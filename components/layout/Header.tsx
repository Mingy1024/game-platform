import Link from "next/link";
import { Suspense } from "react";
import { t } from "@/lib/i18n/zh-TW";
import { Container } from "./Container";
import { HeaderNav, HeaderNavView } from "./HeaderNav";

function BrandMark() {
  return (
    <svg
      aria-hidden="true"
      width="32"
      height="32"
      viewBox="0 0 32 32"
      className="shrink-0"
    >
      <rect width="32" height="32" rx="9" fill="var(--sign)" />
      <path d="M5 16h22" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <circle cx="16" cy="16" r="6" fill="var(--edge)" stroke="#fff" strokeWidth="3" />
    </svg>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-40 bg-card">
      <Container className="relative flex h-16 items-center justify-between">
        <Link
          href="/"
          className="flex min-h-11 items-center gap-2.5 text-xl font-extrabold tracking-wide text-sign"
        >
          <BrandMark />
          {t.brand}
        </Link>
        {/* usePathname 需要 Suspense；fallback 是沒有選取狀態的同一份導覽 */}
        <Suspense fallback={<HeaderNavView pathname={null} />}>
          <HeaderNav />
        </Suspense>
      </Container>
      <div className="platform-edge" aria-hidden="true" />
    </header>
  );
}
