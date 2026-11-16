"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useClientValue } from "@/lib/use-client";
import { Icon } from "@/components/ui/Icon";
import { bestOf } from "@/lib/games/precise-stop/records";
import { useRecords } from "@/lib/games/precise-stop/records-store";
import { dailyRoute, taiwanDateKey, type Mode, type Route } from "@/lib/games/precise-stop/route";
import { fmt, formatFullDate, formatNumber, formatShortDate } from "@/lib/i18n/format";
import { BOARD_ID, useExperience } from "./Experience";
import { RouteStrip } from "./game/panels";

/**
 * 出發看板：仿車站的發車看板。一列一個模式，附上「我的最佳」和出發鈕，
 * 下面預覽今日挑戰 5 站的天氣、坡度和進站速度。
 * 今日路線依台灣日期決定，所以在瀏覽器端計算（伺服器產生的頁面是共用的）。
 */
export function DepartureBoard() {
  const { text, locale, start } = useExperience();
  const records = useRecords();
  const todayKey = useClientValue(taiwanDateKey);
  const today = useMemo<Route | null>(() => (todayKey ? dailyRoute(todayKey) : null), [todayKey]);
  const [stickyVisible, setStickyVisible] = useState(false);
  const boardRef = useRef<HTMLElement>(null);

  // 手機往下捲、看板離開畫面後，底部出現固定的出發列
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const observer = new IntersectionObserver(
      ([entry]) => setStickyVisible(!entry.isIntersecting && entry.boundingClientRect.bottom < 0),
      { threshold: 0 },
    );
    observer.observe(board);
    return () => observer.disconnect();
  }, []);

  const dateKey = today?.dateKey ?? null;
  const best = (mode: Mode) => {
    const value = bestOf(records, mode, dateKey);
    return value === null ? "—" : formatNumber(value, locale);
  };
  const rows: { mode: Mode; name: string; desc: string; primary: boolean }[] = [
    {
      mode: "daily",
      name: text.modes.daily,
      desc: fmt(text.modes.dailyDesc, { date: dateKey ? formatShortDate(dateKey, locale) : "…" }),
      primary: true,
    },
    { mode: "free", name: text.modes.free, desc: text.modes.freeDesc, primary: false },
  ];

  return (
    <>
      <section
        ref={boardRef}
        id={BOARD_ID}
        aria-labelledby="board-title"
        data-testid="departure-board"
        className="on-dark flex flex-col gap-3 rounded-[20px] bg-sign-deep p-3.5 text-white shadow-[inset_0_0_0_3px_var(--sign)] sm:p-[18px]"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="board-title" className="flex items-center gap-2 text-lg font-extrabold sm:text-xl">
            <span className="size-2.5 rounded-full bg-[#4fd69c] shadow-[0_0_8px_#4fd69c]" aria-hidden="true" />
            {text.board.title}
          </h2>
          <span className="text-sm font-bold tabular-nums text-[#c9cfd8]" suppressHydrationWarning>
            {dateKey ? formatFullDate(dateKey, locale) : ""}
          </span>
        </div>

        <div
          aria-hidden="true"
          className="hidden grid-cols-[minmax(0,1fr)_4.5rem_5.5rem_7rem] gap-3 px-4 text-xs font-bold text-[#8fa0c8] lg:grid"
        >
          <span>{text.board.colMode}</span>
          <span>{text.board.colStops}</span>
          <span>{text.board.colBest}</span>
          <span />
        </div>

        {rows.map((row) => (
          <div
            key={row.mode}
            className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-3.5 py-3 lg:grid-cols-[minmax(0,1fr)_4.5rem_5.5rem_7rem] lg:px-4 ${
              row.primary ? "bg-sign" : "bg-white/[0.06]"
            }`}
          >
            <div className="min-w-0">
              <p className="text-xl font-extrabold">{row.name}</p>
              <p className="text-sm text-[#c9cfd8]">
                {row.desc}
                <span className="lg:hidden">
                  {" · "}
                  {text.board.best}{" "}
                  <strong className="tabular-nums text-edge">{best(row.mode)}</strong>
                </span>
              </p>
            </div>
            <span className="hidden text-sm font-bold text-[#c9cfd8] lg:block">{text.board.stops}</span>
            <span
              className="hidden text-lg font-extrabold tabular-nums text-edge lg:block"
              data-testid={`best-${row.mode}`}
            >
              {best(row.mode)}
            </span>
            <button
              type="button"
              onClick={() => start(row.mode)}
              aria-label={fmt(text.board.departMode, { mode: row.name })}
              data-testid={`depart-${row.mode}`}
              className={`press flex min-h-13 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl px-4 text-lg font-extrabold ${
                row.primary
                  ? "bg-express text-white shadow-[0_4px_0_var(--express-deep)]"
                  : "bg-white text-sign shadow-[0_4px_0_#a3adbd]"
              }`}
            >
              {text.board.depart}
              <Icon name="play" size={14} className="fill-current" />
            </button>
          </div>
        ))}

        <div className="rounded-2xl bg-black/[0.22] px-2 pb-2.5 pt-3">
          <p className="mb-2 px-1.5 text-sm font-bold text-[#8fa0c8]">{text.board.routeTitle}</p>
          {today ? (
            <RouteStrip route={today} detailed text={text} locale={locale} />
          ) : (
            <div className="h-[84px]" aria-hidden="true" />
          )}
        </div>
      </section>

      <div
        data-testid="sticky-depart"
        hidden={!stickyVisible}
        className="fixed inset-x-0 bottom-0 z-30 flex gap-2 bg-card/95 px-3 pb-3.5 pt-2.5 shadow-[0_-6px_18px_rgb(16_19_26/0.12)] lg:hidden"
      >
        <button
          type="button"
          onClick={() => start("daily")}
          className="press min-h-13 flex-[1.4] cursor-pointer rounded-2xl bg-express px-2 text-lg font-extrabold text-white shadow-[0_4px_0_var(--express-deep)]"
        >
          {fmt(text.board.departMode, { mode: text.modes.daily })}
        </button>
        <button
          type="button"
          onClick={() => start("free")}
          className="min-h-13 flex-1 cursor-pointer rounded-2xl px-2 font-extrabold text-sign ring-2 ring-inset ring-sign"
        >
          {text.modes.free}
        </button>
      </div>
    </>
  );
}
