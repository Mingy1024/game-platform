"use client";

import type { ReactNode } from "react";
import { loginHref } from "@/lib/account/use-me";

/** 回到目前這一頁的登入連結（給「再試一次」這類自訂樣式的按鈕用） */
export function LoginButtonHref({ className, children }: { className: string; children: ReactNode }) {
  return (
    <a
      href={loginHref("/")}
      onClick={(event) => {
        const url = new URL(window.location.href);
        url.searchParams.delete("login");
        event.currentTarget.href = loginHref(`${url.pathname}${url.search}${url.hash}`);
      }}
      className={className}
    >
      {children}
    </a>
  );
}
