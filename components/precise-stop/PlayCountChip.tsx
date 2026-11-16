"use client";

import { Icon } from "@/components/ui/Icon";
import { fmt, formatNumber } from "@/lib/i18n/format";
import { useFlag } from "@/lib/use-flag";
import { useExperience } from "./Experience";

/**
 * 累計發車次數（所有玩家）。計數需要後端，目前沒有資料來源，
 * 所以預設不顯示；開關打開時顯示版面示意（lib/flags.ts）。
 */
export function PlayCountChip() {
  const { text, locale, nav } = useExperience();
  const enabled = useFlag("playCount");
  if (!enabled) return null;
  const [before, after = ""] = text.playCount.split("{count}");
  return (
    <span
      data-testid="play-count"
      title={fmt(text.playCount, { count: formatNumber(128406, locale) })}
      className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border-2 border-dashed border-[#a3adbd] bg-card py-1 pl-1 pr-3 text-sm font-bold"
    >
      <span className="flex size-7 items-center justify-center rounded-full bg-express text-white">
        <Icon name="train" size={16} />
      </span>
      <span>
        {before}
        <strong className="text-base tabular-nums text-express">{formatNumber(128406, locale)}</strong>
        {after}
      </span>
      <span className="rounded-full bg-muted px-1.5 text-[10px] text-white">{nav.reserved}</span>
    </span>
  );
}
