"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fmt } from "@/lib/i18n/format";
import {
  LOCALES,
  LOCALE_COOKIE,
  localeInfo,
  localePath,
  switchLocalePath,
  type Locale,
} from "@/lib/i18n/locales";

/** 記住使用者自己選的語言，下次從首頁進來沿用（不依瀏覽器語言自動跳轉） */
function remember(target: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${target}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * 語言選單。電腦是按鈕下方的下拉清單，手機是從底部升起的面板。
 * 每個語言只用自己的寫法列出；選了之後留在同一頁（該頁沒有翻譯時回到首頁）。
 */
export function LanguageMenu({
  locale,
  pathname,
  labels,
}: {
  locale: Locale;
  pathname: string | null;
  labels: Dictionary["nav"];
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const current = localeInfo[locale];
  return (
    <div ref={rootRef} className="md:relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={fmt(labels.languageSwitch, { name: current.nativeName })}
        data-testid="language-button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 font-semibold text-ink hover:bg-sign-tint md:border md:border-line md:px-3"
      >
        <Icon name="globe" size={20} />
        <span className="text-sm md:hidden">{current.shortName}</span>
        <span className="hidden md:inline">{current.nativeName}</span>
        <Icon name="down" size={14} className="hidden md:block" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-canvas/55 md:hidden" aria-hidden="true" />
          <div
            id={panelId}
            role="dialog"
            aria-label={labels.language}
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-card px-4 pb-5 pt-2.5 shadow-[0_-12px_32px_rgb(16_19_26/0.18)] md:absolute md:inset-x-auto md:bottom-auto md:right-0 md:top-full md:mt-2 md:w-56 md:rounded-2xl md:border md:border-line md:p-2 md:shadow-[0_12px_32px_rgb(16_19_26/0.18)]"
          >
            <div className="md:hidden">
              <span className="mx-auto block h-1.5 w-10 rounded-full bg-line" aria-hidden="true" />
              <div className="flex items-center justify-between px-1 pb-1.5 pt-1">
                <p className="text-xl font-extrabold text-sign">{labels.language}</p>
                <button
                  type="button"
                  aria-label={labels.close}
                  onClick={() => setOpen(false)}
                  className="flex size-11 cursor-pointer items-center justify-center rounded-full text-muted"
                >
                  <Icon name="close" size={22} />
                </button>
              </div>
            </div>
            <ul className="flex flex-col gap-0.5">
              {LOCALES.map((item) => {
                const selected = item === locale;
                const href = pathname ? switchLocalePath(pathname, item) : localePath(item, "/");
                return (
                  <li key={item}>
                    {/* 不同語言是不同的根版面，用一般連結做整頁切換 */}
                    <a
                      href={href}
                      lang={localeInfo[item].htmlLang}
                      hrefLang={localeInfo[item].htmlLang}
                      aria-current={selected ? "true" : undefined}
                      onClick={() => remember(item)}
                      className={`flex min-h-13 items-center justify-between gap-3 rounded-xl px-4 text-lg md:min-h-11 md:px-3 md:text-base ${
                        selected
                          ? "bg-sign-tint font-extrabold text-sign"
                          : "font-semibold text-ink hover:bg-platform"
                      }`}
                    >
                      {localeInfo[item].nativeName}
                      {selected && <Icon name="check" size={18} />}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
