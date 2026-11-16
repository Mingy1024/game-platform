"use client";

import { useSyncExternalStore } from "react";
import type { GameSession, Snapshot } from "@/lib/games/precise-stop/session";
import type { Judgement } from "@/lib/games/precise-stop/scoring";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export type GameText = Dictionary["preciseStop"];

/** 遊戲框內的尺寸單位：設計稿寬 420 px，實際大小跟著遊戲框縮放 */
export const u = (px: number) => `${(px / 4.2).toFixed(3)}cqw`;

export function useSnapshot(session: GameSession): Snapshot {
  return useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
}

/** 判定的代表色：綠完美、深藍優秀、灰良好、橘過站 */
export const judgementColor: Record<Judgement, { from: string; to: string; text: string }> = {
  perfect: { from: "#1f9a66", to: "#16794f", text: "#4fd69c" },
  great: { from: "#2f55c4", to: "#1d3a8f", text: "#8fb0ff" },
  good: { from: "#5b6478", to: "#3a4152", text: "#ffffff" },
  fair: { from: "#5b6478", to: "#3a4152", text: "#c9cfd8" },
  miss: { from: "#e0560f", to: "#a83606", text: "#ff8a57" },
};

/** 站牌樣式的文字牌：圓角、白色內框、頂部淡高光，不傾斜 */
export function Plate({
  from,
  to,
  tag,
  children,
  size = 30,
}: {
  from: string;
  to: string;
  /** 掛在牌子上緣的小籤條 */
  tag?: string;
  children: React.ReactNode;
  size?: number;
}) {
  return (
    <span
      className="relative inline-flex max-w-[80cqw] items-center justify-center whitespace-nowrap font-black text-white"
      style={{
        fontSize: u(size),
        lineHeight: 1,
        padding: `${u(size * 0.38)} ${u(size * 0.65)}`,
        borderRadius: u(size * 0.52),
        background: `linear-gradient(${from}, ${to})`,
        boxShadow: `inset 0 0 0 ${u(3)} ${from}, inset 0 0 0 ${u(5)} rgba(255,255,255,0.85), inset 0 ${u(size * 0.5)} 0 ${u(-size * 0.2)} rgba(255,255,255,0.16), 0 ${u(6)} ${u(10)} rgba(16,19,26,0.35)`,
        gap: u(size * 0.3),
      }}
    >
      {tag && (
        <span
          className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full font-black text-ink"
          style={{
            top: u(-size * 0.42),
            fontSize: u(size * 0.46),
            padding: `${u(2)} ${u(size * 0.4)}`,
            background: "#ffc83d",
            border: `${u(2)} solid #fff`,
          }}
        >
          {tag}
        </span>
      )}
      {children}
    </span>
  );
}
