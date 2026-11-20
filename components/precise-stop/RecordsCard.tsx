"use client";

import { useState } from "react";
import { bestOf } from "@/lib/games/precise-stop/records";
import { useRecords } from "@/lib/games/precise-stop/records-store";
import { taiwanDateKey } from "@/lib/games/precise-stop/route";
import { fmt, formatNumber, formatShortDate } from "@/lib/i18n/format";
import { useClientValue } from "@/lib/use-client";
import { useFlag } from "@/lib/use-flag";
import { RecordsAccount } from "@/components/account/RecordsAccount";
import { useExperience } from "./Experience";

const SAMPLE_PLAYERS = [
  ["Riku", "#cc4409", 5912, 5, 3],
  ["Mina", "#1d3a8f", 5874, 5, 12],
  ["Noa", "#16794f", 5801, 4, 60],
  ["Kai", "#a83606", 5766, 4, 70],
  ["Sora", "#4a5263", 5702, 4, 120],
  ["Rin", "#152b6b", 5655, 4, 130],
  ["Yui", "#cc4409", 5590, 3, 180],
  ["Leo", "#16794f", 5541, 3, 240],
  ["Hana", "#1d3a8f", 5498, 3, 300],
  ["Tomo", "#4a5263", 5460, 3, 360],
] as const;

/**
 * 我的紀錄，以及預留的「全站排行」分頁。
 * 排行榜還沒有後端，預設不顯示（lib/flags.ts），開關打開時顯示的是版面示意，資料是固定的樣本。
 * 登入開關打開時，卡片下方換成帳號區塊（components/account/RecordsAccount.tsx）。
 */
export function RecordsCard() {
  const { text, locale, nav, account } = useExperience();
  const records = useRecords();
  const showRank = useFlag("leaderboard");
  const showLogin = useFlag("login");
  const [tab, setTab] = useState<"mine" | "rank">("mine");
  const dateKey = useClientValue(taiwanDateKey);

  const number = (value: number | null) => (value === null ? "—" : formatNumber(value, locale));
  const daily = bestOf(records, "daily", dateKey);
  const tabClass = (active: boolean) =>
    `flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-1.5 px-2 font-bold ${
      active ? "font-extrabold text-sign shadow-[inset_0_-3px_0_var(--sign)]" : "text-muted"
    }`;

  const stats = [
    { label: text.records.dailyBest, value: number(daily), tint: "bg-edge-tint", testId: "record-daily" },
    { label: text.records.freeBest, value: number(records.free), tint: "bg-sign-tint", testId: "record-free" },
    {
      label: text.records.perfectStops,
      value: fmt(text.records.perfectCount, { count: formatNumber(records.perfectStops, locale) }),
      tint: "bg-platform",
      testId: "record-perfect",
    },
  ];

  return (
    <section
      aria-labelledby="records-title"
      data-testid="records-card"
      className="overflow-hidden rounded-[18px] border border-line bg-card"
    >
      {showRank ? (
        <div role="tablist" className="flex border-b border-line">
          <button
            type="button"
            role="tab"
            id="records-title"
            aria-selected={tab === "mine"}
            onClick={() => setTab("mine")}
            className={tabClass(tab === "mine")}
          >
            {text.records.tabMine}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "rank"}
            onClick={() => setTab("rank")}
            data-testid="rank-tab"
            className={tabClass(tab === "rank")}
          >
            {text.records.tabRank}
            <span className="rounded-full border-[1.5px] border-dashed border-[#a3adbd] px-2 text-xs text-muted">
              {nav.reserved}
            </span>
          </button>
        </div>
      ) : (
        <h2 id="records-title" className="px-4 pt-4 text-xl font-extrabold text-ink">
          {text.records.tabMine}
        </h2>
      )}

      {tab === "mine" || !showRank ? (
        <>
          <dl className="grid grid-cols-3 gap-2.5 p-4 pb-3">
            {stats.map((item) => (
              <div key={item.label} className={`rounded-xl px-3 py-2.5 ${item.tint}`}>
                <dt className="text-xs font-bold leading-snug text-muted">{item.label}</dt>
                <dd className="mt-0.5 text-xl font-black tabular-nums sm:text-2xl" data-testid={item.testId}>
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
          {showLogin ? (
            <RecordsAccount locale={locale} labels={account} records={text.records} />
          ) : (
            <p className="px-4 pb-4 text-sm text-muted">{text.records.deviceNote}</p>
          )}
        </>
      ) : (
        <div data-testid="leaderboard">
          <div role="group" aria-label={text.rank.scopeLabel} className="flex flex-wrap items-center gap-1.5 px-4 pb-1.5 pt-3">
            {[
              fmt(text.rank.daily, { date: dateKey ? formatShortDate(dateKey, locale) : "" }),
              text.rank.week,
              text.rank.free,
            ].map((label, index) => (
              <button
                key={label}
                type="button"
                aria-pressed={index === 0}
                disabled={index !== 0}
                className={`min-h-9 rounded-full px-3.5 text-sm ${
                  index === 0 ? "bg-sign font-extrabold text-white" : "bg-platform font-bold text-muted"
                }`}
              >
                {label}
              </button>
            ))}
            <span className="ml-auto hidden text-sm text-muted lg:block">
              {fmt(text.rank.updated, { count: formatNumber(3284, locale) })}
            </span>
          </div>
          <ol className="flex flex-col gap-0.5 px-2 pt-1">
            {SAMPLE_PLAYERS.map(([name, color, score, perfect, minutes], index) => (
              <li
                key={name}
                className={`flex min-h-12 items-center gap-2.5 rounded-xl px-3 ${index < 3 ? "bg-[#fff9e6]" : ""} ${index >= 7 ? "max-lg:hidden" : ""}`}
              >
                <span
                  className={`flex size-[30px] shrink-0 items-center justify-center rounded-full text-[15px] font-black tabular-nums ${
                    index === 0
                      ? "bg-edge shadow-[inset_0_-3px_0_#b8860b]"
                      : index === 1
                        ? "bg-line shadow-[inset_0_-3px_0_#8a93a3]"
                        : index === 2
                          ? "bg-[#e8a06b] shadow-[inset_0_-3px_0_var(--express-deep)]"
                          : "text-muted"
                  }`}
                >
                  {index + 1}
                </span>
                <span
                  aria-hidden="true"
                  className="flex size-[30px] shrink-0 items-center justify-center rounded-full text-sm font-black text-white"
                  style={{ background: color }}
                >
                  {name[0]}
                </span>
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate font-extrabold">{name}</span>
                  <span className="hidden text-xs text-muted lg:block">
                    {minutes < 60
                      ? fmt(text.rank.minutesAgo, { count: minutes })
                      : fmt(text.rank.hoursAgo, { count: Math.round(minutes / 60) })}
                  </span>
                </span>
                <span className="text-sm font-bold text-signal" title={text.rank.perfectStops}>
                  ★ {perfect}
                </span>
                <span className="w-16 text-right text-[17px] font-black tabular-nums">
                  {formatNumber(score, locale)}
                </span>
              </li>
            ))}
          </ol>
          <button type="button" disabled className="mx-auto block min-h-10 px-3.5 text-sm font-bold text-sign lg:hidden">
            {text.rank.viewTop}
          </button>
          <div className="mx-4 mb-4 mt-1.5 flex min-h-13 items-center gap-2.5 rounded-xl bg-edge-tint px-3 py-2.5 text-sm">
            <p className="min-w-0 flex-1 leading-snug">
              <strong>
                {daily === null ? text.records.none : fmt(text.rank.yourBest, { score: number(daily) })}
              </strong>
              <br />
              <span className="text-muted">{text.rank.loginToRank}</span>
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
