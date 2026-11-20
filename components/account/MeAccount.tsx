"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { detectInAppBrowser } from "@/lib/account/in-app-browser";
import { deleteAccount, logout, useMe } from "@/lib/account/use-me";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { useClientValue } from "@/lib/use-client";
import { Banner } from "./LoginResultBanner";
import { InAppNotice, LoginButton } from "./LoginButton";
import { NickName } from "./NickName";
import { nickText } from "@/lib/account/nick/nick";

/**
 * 我的紀錄頁（只有繁體中文）的帳號部分：最上面的帳號卡、最下面的登出與刪除帳號。
 * children 是中間原本的紀錄區塊。
 */
export function MeAccount({ labels, children }: { labels: Dictionary["account"]; children: ReactNode }) {
  const me = useMe();
  const [notice, setNotice] = useState<"loggedOut" | "deleted" | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return (
    <>
      {notice ? (
        <div className="mt-6">
          <Banner tone="info" onClose={() => setNotice(null)} closeLabel={labels.close}>
            {notice === "loggedOut" ? "已經登出了。" : "已經刪除了。"}
          </Banner>
        </div>
      ) : null}

      <AccountCard labels={labels} />

      {children}

      {me.status === "loggedIn" ? (
        <AccountActions
          nick={nickText(me.nick, "zh-TW")}
          onLoggedOut={() => setNotice("loggedOut")}
          onDeleted={() => setNotice("deleted")}
        />
      ) : null}
    </>
  );
}

function AccountCard({ labels }: { labels: Dictionary["account"] }) {
  const me = useMe();
  const inApp = useClientValue(() => detectInAppBrowser(navigator.userAgent));
  const card = "mt-6 flex flex-wrap items-center gap-x-6 gap-y-4 rounded-[20px] border border-line bg-card px-6 py-5";

  if (me.status === "loading") return <div aria-hidden="true" className={`${card} min-h-[118px]`} />;

  if (me.status === "loggedIn") {
    return (
      <section aria-labelledby="account-title" className={card} data-testid="me-account">
        <div className="flex min-w-0 flex-[999_1_26rem] flex-col gap-1">
          <h2 id="account-title" className="text-[15px] font-bold text-muted">
            {labels.nickLabel}
          </h2>
          <p className="text-[30px] leading-tight">
            <NickName nick={me.nick} locale="zh-TW" numberClassName="text-[22px]" />
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[15px] font-bold text-signal">
            <Icon name="check" size={18} />
            已用 Google 登入，只存帳號代碼
          </p>
        </div>
        <Link
          href="/me/settings"
          className="press inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-card px-5 font-bold text-sign ring-[1.5px] ring-inset ring-sign hover:bg-sign-tint"
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 20h4L19 9l-4-4L4 16v4z" />
          </svg>
          {labels.changeNick}
        </Link>
      </section>
    );
  }

  return (
    <section aria-labelledby="account-title" className={card} data-testid="me-account">
      <div className="min-w-0 flex-[999_1_26rem]">
        <h2 id="account-title" className="text-xl font-extrabold">
          還沒登入
        </h2>
        <p className="mt-1.5 leading-relaxed text-muted">
          下面的紀錄只存在這台裝置的瀏覽器，清除瀏覽器資料就會消失。用 Google 登入，之後就能保留在帳號裡。
          {labels.privacyNote}
          <Link href="/privacy" className="font-bold text-sign underline underline-offset-2">
            {labels.privacyLink}
          </Link>
        </p>
      </div>
      {inApp === "other" ? <InAppNotice labels={labels} /> : <LoginButton labels={labels} size="lg" />}
    </section>
  );
}

function AccountActions({
  nick,
  onLoggedOut,
  onDeleted,
}: {
  nick: string;
  onLoggedOut(): void;
  onDeleted(): void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // 焦點移到「取消」，避免按 Enter 就刪掉
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);

  const run = async (action: () => Promise<boolean>, done: () => void) => {
    setBusy(true);
    setFailed(false);
    const ok = await action();
    setBusy(false);
    if (ok) done();
    else setFailed(true);
  };

  const plain =
    "press inline-flex min-h-12 items-center rounded-full border border-line bg-card px-[22px] font-bold disabled:opacity-60";

  return (
    <section aria-labelledby="account-actions" className="mt-10 flex flex-col gap-3 border-t border-line pt-6">
      <h2 id="account-actions" className="text-xl font-extrabold">
        帳號
      </h2>
      {confirming ? (
        <div
          role="alertdialog"
          aria-labelledby="delete-title"
          aria-describedby="delete-text"
          className="flex max-w-xl flex-col gap-3 rounded-[18px] border-2 border-express bg-card px-4 py-[18px]"
        >
          <h3 id="delete-title" className="text-[22px] font-black text-express-deep">
            刪除帳號？
          </h3>
          <p id="delete-text" className="leading-relaxed">
            會刪除你的帳號、暱稱「<strong>{nick}</strong>」和帳號裡的所有紀錄，<strong>無法復原</strong>。
          </p>
          <p className="text-[15px] leading-relaxed text-muted">
            這台裝置上的紀錄不受影響。之後再用同一個 Google 帳號登入，會是全新的帳號。
          </p>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={busy}
              onClick={() => run(deleteAccount, onDeleted)}
              className="press min-h-13 flex-1 rounded-full bg-express-deep px-6 text-[17px] font-bold text-white disabled:opacity-60"
            >
              確定刪除
            </button>
            <button
              ref={cancelRef}
              type="button"
              disabled={busy}
              onClick={() => {
                setConfirming(false);
                setFailed(false);
              }}
              className="press min-h-13 flex-1 rounded-full border border-line bg-card px-6 text-[17px] font-bold disabled:opacity-60"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={busy} onClick={() => run(logout, onLoggedOut)} className={plain}>
            登出
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirming(true)}
            className={`${plain} text-express-deep`}
          >
            刪除帳號
          </button>
        </div>
      )}
      {failed ? (
        <div role="alert" className="max-w-xl rounded-[14px] border-[1.5px] border-express bg-edge-tint px-3.5 py-3">
          沒有成功，等一下再試一次。
        </div>
      ) : null}
      {!confirming ? (
        <p className="text-[15px] text-muted">
          刪除會把暱稱和帳號裡的紀錄全部刪掉，無法復原。這台裝置上的紀錄不受影響。
        </p>
      ) : null}
    </section>
  );
}
