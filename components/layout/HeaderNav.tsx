"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { LanguageMenu } from "./LanguageMenu";

type Labels = Dictionary["nav"];

/** 這三頁目前只有繁體中文，所有語言都連到同一個網址 */
const links = [
  { href: "/games", key: "games" },
  { href: "/hot", key: "hot" },
  { href: "/me", key: "me" },
] as const;

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * 導覽連結。桌面橫排；手機收進頁首下方的選單，不使用固定底部列，
 * 以免占用遊戲的觸控區。語言選單和登入預留位在兩種寬度都直接顯示。
 */
export function HeaderNavView({
  pathname,
  locale,
  labels,
}: {
  pathname: string | null;
  locale: Locale;
  labels: Labels;
}) {
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
    <nav aria-label={labels.label} className="flex shrink-0 items-center gap-1">
      <ul className="hidden items-center gap-1 md:flex">
        {links.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center whitespace-nowrap rounded-full px-4 font-semibold transition-colors ${
                  active ? "bg-edge text-ink" : "text-sign hover:bg-sign-tint"
                }`}
              >
                {labels[link.key]}
              </Link>
            </li>
          );
        })}
      </ul>

      <LanguageMenu locale={locale} pathname={pathname} labels={labels} />

      <button
        type="button"
        className="flex size-11 cursor-pointer items-center justify-center rounded-full text-sign hover:bg-sign-tint md:hidden"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? labels.closeMenu : labels.openMenu}
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
                  {labels[link.key]}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

export function HeaderNav({ locale, labels }: { locale: Locale; labels: Labels }) {
  const pathname = usePathname();
  return <HeaderNavView pathname={pathname} locale={locale} labels={labels} />;
}
