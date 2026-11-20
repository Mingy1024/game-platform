"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { detectInAppBrowser, externalBrowserUrl } from "@/lib/account/in-app-browser";
import { loginHref } from "@/lib/account/use-me";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fmt } from "@/lib/i18n/format";
import { useClientValue } from "@/lib/use-client";
import { GoogleMark } from "./GoogleMark";

/** 目前這一頁（拿掉登入結果參數），登入後回到這裡 */
function currentPath(): string {
  const url = new URL(window.location.href);
  url.searchParams.delete("login");
  return `${url.pathname}${url.search}${url.hash}`;
}

const sizes = {
  md: { button: "min-h-12 gap-2 py-1.5 pl-2 pr-4 text-base", mark: "size-8", icon: 18 },
  lg: { button: "min-h-13 gap-2.5 py-1.5 pl-2 pr-5 text-[17px]", mark: "size-9", icon: 20 },
} as const;

/**
 * 「用 Google 登入」按鈕。在 LINE、Facebook、Instagram、Threads 的內建瀏覽器裡，
 * 改顯示「用瀏覽器打開」的提示（Android 版 LINE 則直接換成跳出去的按鈕）。
 */
export function LoginButton({
  labels,
  size = "md",
  className = "",
}: {
  labels: Dictionary["account"];
  size?: keyof typeof sizes;
  className?: string;
}) {
  const inApp = useClientValue(() => detectInAppBrowser(navigator.userAgent));
  const style = sizes[size];
  const look = `press inline-flex shrink-0 items-center rounded-full bg-sign font-bold text-white hover:bg-sign-deep ${style.button} ${className}`;

  if (inApp === "other") return <InAppNotice labels={labels} />;

  if (inApp === "line-android") {
    return (
      <a href={externalBrowserUrl(window.location.href)} className={look} data-testid="login-button">
        <span className={`flex items-center justify-center rounded-full bg-card text-sign ${style.mark}`}>
          <Icon name="globe" size={style.icon} />
        </span>
        {labels.openBrowser}
      </a>
    );
  }

  return (
    <a
      href={loginHref("/")}
      onClick={(event) => {
        event.currentTarget.href = loginHref(currentPath());
      }}
      className={look}
      data-testid="login-button"
    >
      <span className={`flex items-center justify-center rounded-full bg-card ${style.mark}`}>
        <GoogleMark size={style.icon} />
      </span>
      {labels.login}
    </a>
  );
}

/** App 內建瀏覽器的提示：說明要用瀏覽器打開，附「複製連結」和三步驟 */
export function InAppNotice({ labels }: { labels: Dictionary["account"] }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // 少數 App 不給寫剪貼簿；使用者還是可以照步驟從選單打開
    }
  };
  return (
    <div className="flex w-full flex-col gap-3 rounded-[14px] bg-edge-tint p-3.5" data-testid="in-app-notice">
      <p className="text-[15px] leading-relaxed">
        <strong>{labels.inAppTitle}</strong>
        <br />
        <span className="text-muted">{labels.inAppHint}</span>
      </p>
      <ol className="list-decimal pl-5 text-[15px] leading-relaxed">
        <li>{fmt(labels.inAppStep1, { menu: "⋯" })}</li>
        <li>{labels.inAppStep2}</li>
        <li>{labels.inAppStep3}</li>
      </ol>
      <button
        type="button"
        onClick={copy}
        aria-live="polite"
        className="press flex min-h-12 items-center justify-center gap-1.5 rounded-full bg-sign font-bold text-white hover:bg-sign-deep"
      >
        <Icon name={copied ? "check" : "link"} size={18} />
        {copied ? labels.copied : labels.copyLink}
      </button>
    </div>
  );
}
