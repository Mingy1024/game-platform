"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { t } from "@/lib/i18n/zh-TW";

const links = [
  { href: "/games", label: t.nav.games },
  { href: "/hot", label: t.nav.hot },
  { href: "/me", label: t.nav.me },
];

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * 導覽連結。桌面橫排；手機收進頁首下方的選單，不使用固定底部列，
 * 以免占用遊戲的觸控區。
 */
export function HeaderNavView({ pathname }: { pathname: string | null }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <nav aria-label={t.nav.label} className="flex items-center">
      <ul className="hidden items-center gap-1 md:flex">
        {links.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center rounded-full px-4 font-semibold transition-colors ${
                  active
                    ? "bg-edge text-ink"
                    : "text-sign hover:bg-sign-tint"
                }`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        className="flex size-11 cursor-pointer items-center justify-center rounded-full text-sign hover:bg-sign-tint md:hidden"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? t.nav.closeMenu : t.nav.openMenu}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name={open ? "close" : "menu"} size={24} />
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-line bg-card shadow-[0_12px_24px_-16px_rgb(20_23_31/0.35)] md:hidden"
      >
        <ul className="mx-auto max-w-[1200px] px-4 py-2">
          {links.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={`flex min-h-12 items-center rounded-xl px-3 text-lg font-semibold ${
                    active ? "bg-edge-tint text-ink" : "text-sign"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

export function HeaderNav() {
  const pathname = usePathname();
  return <HeaderNavView pathname={pathname} />;
}
