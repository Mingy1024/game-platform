"use client";

import Link from "next/link";
import { detectInAppBrowser } from "@/lib/account/in-app-browser";
import { useMe } from "@/lib/account/use-me";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { useClientValue } from "@/lib/use-client";
import { InAppNotice, LoginButton } from "./LoginButton";
import { NickName } from "./NickName";

/**
 * 遊戲介紹頁「我的紀錄」卡下方的帳號區塊（設計稿「紀錄卡」畫板）。
 * 未登入：說明紀錄只在這台裝置＋登入按鈕；已登入：暱稱＋改暱稱。
 */
export function RecordsAccount({
  locale,
  labels,
  records,
}: {
  locale: Locale;
  labels: Dictionary["account"];
  records: { deviceOnly: string; loginHint: string };
}) {
  const me = useMe();
  const inApp = useClientValue(() => detectInAppBrowser(navigator.userAgent));

  if (me.status === "loading") {
    // 還不知道有沒有登入：先佔好位置，避免畫面跳動
    return <div aria-hidden="true" className="mx-4 mb-4 min-h-[72px] rounded-[14px] bg-platform" />;
  }

  if (me.status === "loggedIn") {
    return (
      <div
        data-testid="records-logged-in"
        className="mx-4 mb-4 flex items-center gap-3 rounded-[14px] bg-signal-tint px-3.5 py-3"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-signal text-white">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <p className="min-w-0 flex-1 text-[15px] leading-normal">
          <span className="font-bold text-signal">{labels.loggedIn}</span>
          <br />
          <span className="text-muted">{labels.nickLabel}</span>{" "}
          <NickName nick={me.nick} locale={locale} className="text-[17px]" numberClassName="text-[15px]" />
        </p>
        <Link
          href="/me/settings"
          className="press flex min-h-11 shrink-0 items-center rounded-full border border-line bg-card px-3.5 text-[15px] font-bold text-sign"
        >
          {labels.changeNick}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-4 mb-4 flex flex-col gap-2.5" data-testid="login-hint">
      {inApp === "other" ? (
        <InAppNotice labels={labels} />
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-[14px] bg-sign-tint px-3.5 py-3">
          <p className="min-w-[12rem] flex-1 text-[15px] leading-normal">
            <strong>{records.deviceOnly}</strong>
            <br />
            <span className="text-muted">{records.loginHint}</span>
          </p>
          <LoginButton labels={labels} />
        </div>
      )}
      <p className="text-sm text-muted">
        {labels.privacyNote}
        <Link href="/privacy" className="font-bold text-sign underline underline-offset-2">
          {labels.privacyLink}
        </Link>
      </p>
    </div>
  );
}
