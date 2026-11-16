"use client";

import type { Dictionary } from "@/lib/i18n/dictionaries";
import { useFlag } from "@/lib/use-flag";

/**
 * Google 登入的預留位置。帳號功能還沒接上，預設不顯示（lib/flags.ts）；
 * 開關打開時顯示設計稿上的樣式，按鈕維持停用。
 */
export function LoginSlot({ labels }: { labels: Dictionary["nav"] }) {
  const enabled = useFlag("login");
  if (!enabled) return null;
  return (
    <button
      type="button"
      disabled
      aria-label={`${labels.login}（${labels.reserved}）`}
      data-testid="login-slot"
      className="flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full border-2 border-dashed border-[#a3adbd] px-1.5 font-semibold text-ink md:pr-3.5"
    >
      <span className="flex size-8 items-center justify-center rounded-full border border-line bg-card text-sm font-black text-sign">
        G
      </span>
      <span className="hidden md:inline">{labels.login}</span>
      <span className="hidden rounded-full bg-muted px-2 py-0.5 text-xs text-white md:inline">
        {labels.reserved}
      </span>
    </button>
  );
}
