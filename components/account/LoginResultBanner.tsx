"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Container } from "@/components/layout/Container";
import { Icon } from "@/components/ui/Icon";
import { useMe } from "@/lib/account/use-me";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { LoginButtonHref } from "./LoginRetry";
import { NickName } from "./NickName";

type Result = "ok" | "error";

/**
 * 從 Google 回來後，頁首下方出現的提示條（網址上的 ?login=ok／error）。
 * 參數讀到後馬上從網址拿掉，重新整理不會再出現。
 * 成功 5 秒後自己收起；失敗要按關閉才會消失。
 */
export function LoginResultBanner({ locale, labels }: { locale: Locale; labels: Dictionary["account"] }) {
  const [result, setResult] = useState<Result | null>(null);
  const me = useMe();

  useEffect(() => {
    const url = new URL(window.location.href);
    const value = url.searchParams.get("login");
    if (value !== "ok" && value !== "error") return;
    url.searchParams.delete("login");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    // 讀網址是瀏覽器端才有的資訊，只能在 effect 裡設定
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResult(value);
  }, []);

  useEffect(() => {
    if (result !== "ok") return;
    const timer = window.setTimeout(() => setResult(null), 5000);
    return () => window.clearTimeout(timer);
  }, [result]);

  if (!result) return null;
  const close = () => setResult(null);

  return (
    <Container className="pt-4">
      {result === "ok" ? (
        <Banner tone="ok" onClose={close} closeLabel={labels.close}>
          <strong>{labels.loginOk}</strong>
          {me.status === "loggedIn" ? (
            <>
              {labels.sep}
              {labels.nickLabel} <NickName nick={me.nick} locale={locale} />
            </>
          ) : null}
        </Banner>
      ) : (
        <Banner
          tone="error"
          onClose={close}
          closeLabel={labels.close}
          action={<LoginButtonHref className="press flex min-h-11 shrink-0 items-center rounded-full bg-express px-3.5 text-[15px] font-bold text-white hover:bg-express-deep">{labels.retry}</LoginButtonHref>}
        >
          <strong>{labels.loginError}</strong>
          {labels.loginErrorRest}
        </Banner>
      )}
    </Container>
  );
}

/** 提示條外框：ok 綠、error 橘、info 藍 */
export function Banner({
  tone,
  onClose,
  closeLabel,
  action,
  children,
}: {
  tone: "ok" | "error" | "info";
  onClose?: () => void;
  closeLabel: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const look = {
    ok: "border-[1.5px] border-signal bg-signal-tint",
    error: "border-[1.5px] border-express bg-edge-tint",
    info: "bg-sign-tint",
  }[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      data-testid={`banner-${tone}`}
      className={`flex items-center gap-3 rounded-[14px] py-2.5 pl-3.5 pr-2 ${look}`}
    >
      {tone === "ok" ? (
        <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--signal)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <circle cx="12" cy="12" r="9.5" />
          <path d="M7.5 12.3l3 3 6-6.3" />
        </svg>
      ) : tone === "error" ? (
        <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--express-deep)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <circle cx="12" cy="12" r="9.5" />
          <path d="M12 7.5v5.5M12 16.5v.2" />
        </svg>
      ) : null}
      <p className="min-w-0 flex-1 leading-normal">{children}</p>
      {action}
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-black/5"
        >
          <Icon name="close" size={20} />
        </button>
      ) : null}
    </div>
  );
}
