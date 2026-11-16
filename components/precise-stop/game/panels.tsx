"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { STATIONS_PER_RUN } from "@/lib/games/precise-stop/config";
import type { SaveOutcome } from "@/lib/games/precise-stop/records";
import { gradeKind, type Route, type RouteStop } from "@/lib/games/precise-stop/route";
import { comboMultiplier } from "@/lib/games/precise-stop/scoring";
import type { Snapshot } from "@/lib/games/precise-stop/session";
import { stationBackground, stationName } from "@/lib/games/precise-stop/stations";
import { fmt, formatDecimal, formatError, formatNumber } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/locales";
import { judgementColor, u, type GameText } from "./shared";

type Common = { text: GameText; locale: Locale };

const pill = (background: string, color = "#fff") => ({
  padding: `${u(4)} ${u(12)}`,
  borderRadius: "999px",
  background,
  color,
  fontSize: u(14),
  fontWeight: 900,
  whiteSpace: "nowrap" as const,
});

const chip = {
  padding: `${u(3)} ${u(10)}`,
  borderRadius: "999px",
  background: "rgba(255,255,255,0.88)",
  color: "#14171f",
  fontSize: u(13),
  fontWeight: 700,
  whiteSpace: "nowrap" as const,
};

export function gradeLabel(stop: RouteStop, text: GameText): string {
  const kind = gradeKind(stop.grade);
  if (kind === "flat") return text.grade.flat;
  const value = Math.round(Math.abs(stop.grade) * 1000) / 10;
  return fmt(kind === "up" ? text.grade.upValue : text.grade.downValue, { value });
}

/** 場景上方的站別、連擊、天氣標籤 */
export function SceneTags({
  snapshot,
  text,
  locale,
  onPause,
}: Common & { snapshot: Snapshot; onPause(): void }) {
  const { stop, index, streak, phase, zoomed } = snapshot;
  const name = stationName(stop.station, locale).name;
  const last = snapshot.results.at(-1);
  // 判定後顯示這一站套用的倍率；行駛中顯示「這一站停準的話」會拿到的倍率
  const multiplier = phase === "judged" && last ? last.multiplier : comboMultiplier(streak + 1);
  return (
    <div
      className="absolute flex items-start justify-between"
      style={{ left: u(14), right: u(14), top: u(12), gap: u(8) }}
    >
      <div className="flex min-w-0 flex-col items-start" style={{ gap: u(6) }}>
        <div className="flex flex-wrap" style={{ gap: u(6) }}>
          <span style={pill("#1d3a8f")} data-testid="station-pill">
            {fmt(text.hud.station, { n: index + 1, total: STATIONS_PER_RUN })} · {name}
          </span>
          {multiplier > 1 && (
            <span style={pill("#ffc83d", "#14171f")} data-testid="combo-pill">
              {fmt(text.hud.combo, { value: multiplier.toFixed(1) })}
            </span>
          )}
        </div>
        <div className="flex flex-wrap" style={{ gap: u(6) }}>
          {zoomed && phase === "running" ? (
            <span style={{ ...chip, background: "#14171f", color: "#ffc83d" }}>{text.hud.zoomTag}</span>
          ) : (
            <>
              <span style={chip}>{stop.rain ? text.weather.rain : text.weather.clear}</span>
              <span style={chip}>{gradeLabel(stop, text)}</span>
            </>
          )}
        </div>
      </div>
      {phase === "running" && (
        <button
          type="button"
          data-no-brake
          aria-label={text.stage.pause}
          onClick={onPause}
          className="flex shrink-0 cursor-pointer items-center justify-center text-white"
          style={{
            width: u(44),
            height: u(44),
            minWidth: 44,
            minHeight: 44,
            borderRadius: u(12),
            background: "rgba(16,19,26,0.75)",
          }}
        >
          <Icon name="pause" size={22} />
        </button>
      )}
    </div>
  );
}

/** 行駛中的儀表：進度、速度、距離、煞車力、時間、煞車鈕 */
export function Hud({ snapshot, text, locale }: Common & { snapshot: Snapshot }) {
  const { train, stop, braking, zoomed } = snapshot;
  const progress = Math.min(1, Math.max(0, 1 - train.distance / stop.startDistance));
  const distance =
    zoomed && train.distance < 5 && train.distance > -5
      ? formatDecimal(Math.abs(train.distance), locale, 2)
      : formatDecimal(Math.abs(train.distance), locale, 1);
  const percent = Math.round(train.brake * 100);
  const late = train.elapsed > stop.targetTime;
  const label = { fontSize: u(13), fontWeight: 700, color: "#aab3c5" };
  const big = { fontSize: u(34), fontWeight: 900, lineHeight: 1.1 };
  return (
    <div
      className="absolute inset-x-0 bottom-0 flex flex-col"
      style={{ top: `${(340 / 560) * 100}%`, padding: `${u(14)} ${u(18)} ${u(16)}`, gap: u(10) }}
    >
      <div
        role="progressbar"
        aria-label={text.hud.progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        className="relative"
        style={{ height: u(10), borderRadius: u(5), background: "#2a3040" }}
      >
        <div
          className="absolute inset-y-0 left-0"
          style={{ width: `${progress * 100}%`, borderRadius: u(5), background: "#6b7a99" }}
        />
        <div
          className="absolute"
          style={{
            left: `${progress * 100}%`,
            top: u(-4),
            width: u(18),
            height: u(18),
            marginLeft: u(-9),
            borderRadius: u(6),
            background: "#cc4409",
            border: `${u(2)} solid #fff`,
          }}
        />
        <div
          className="absolute right-0"
          style={{ top: u(-6), width: u(6), height: u(22), borderRadius: u(2), background: "#ffc83d" }}
        />
      </div>
      <div className="flex items-end justify-between">
        <div className="flex flex-col">
          <span style={label}>{text.hud.speed}</span>
          <span className="tabular-nums" style={big} data-testid="hud-speed">
            {Math.round(snapshot.speedKmh)}
            <span style={{ fontSize: u(16), marginLeft: u(4) }}>km/h</span>
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span style={label}>{zoomed ? text.hud.toMarkPrecise : text.hud.toMark}</span>
          <span className="tabular-nums" style={{ ...big, color: "#ffc83d" }} data-testid="hud-distance">
            {train.distance < 0 ? "+" : ""}
            {distance}
            <span style={{ fontSize: u(16), marginLeft: u(4) }}>m</span>
          </span>
        </div>
      </div>
      <div className="flex justify-between" style={{ ...label, gap: u(8) }}>
        <span style={{ color: braking ? "#fff" : undefined }} data-testid="hud-brake">
          {fmt(text.hud.brake, { percent })}　{braking ? text.hud.braking : text.hud.coasting}
        </span>
        <span className="tabular-nums text-right" style={{ color: late ? "#ff8a57" : undefined }}>
          {fmt(text.hud.elapsed, {
            elapsed: formatDecimal(train.elapsed, locale),
            target: formatDecimal(stop.targetTime, locale),
          })}
        </span>
      </div>
      <div style={{ height: u(8), borderRadius: u(4), background: "#2a3040", overflow: "hidden" }}>
        <div style={{ width: `${percent}%`, height: "100%", background: "#ffc83d" }} />
      </div>
      {/* 整個遊戲框都能按住煞車；這顆按鈕讓操作一目了然，也給鍵盤和輔助工具使用 */}
      <div
        aria-hidden="true"
        className="flex items-center justify-center font-black text-white"
        style={{
          marginTop: u(2),
          minHeight: u(60),
          borderRadius: u(18),
          fontSize: u(22),
          background: braking ? "#a83606" : "#cc4409",
          boxShadow: braking ? `inset 0 ${u(4)} 0 #7d2804` : `0 ${u(5)} 0 #a83606`,
          transform: braking ? `translateY(${u(3)})` : undefined,
        }}
      >
        {braking ? text.hud.brakingButton : text.hud.holdBrake}
      </div>
    </div>
  );
}

/** 標線還沒進畫面時，右側的距離提示 */
export function TargetHint({ snapshot, text, locale }: Common & { snapshot: Snapshot }) {
  return (
    <div
      data-testid="target-hint"
      className="absolute flex items-center"
      style={{ right: u(6), top: u(190), gap: u(4), filter: "drop-shadow(0 4px 6px rgba(16,19,26,0.5))" }}
    >
      <div
        className="flex flex-col items-center"
        style={{
          padding: `${u(7)} ${u(14)}`,
          borderRadius: u(16),
          background: "rgba(16,19,26,0.88)",
          border: `${u(2.5)} solid #ffc83d`,
        }}
      >
        <span style={{ fontSize: u(12), fontWeight: 900, color: "#ffc83d", whiteSpace: "nowrap" }}>
          {text.hud.target}
        </span>
        <span className="tabular-nums" style={{ fontSize: u(21), fontWeight: 900, lineHeight: 1.2 }}>
          {formatNumber(snapshot.train.distance, locale)} m
        </span>
      </div>
      <svg aria-hidden="true" viewBox="0 0 16 24" style={{ width: u(14), height: u(22) }}>
        <path d="M2 2l12 10L2 22z" fill="#ffc83d" stroke="#14171f" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function BriefRow({
  icon,
  tint,
  color,
  title,
  body,
}: {
  icon: "rain" | "sun" | "slopeDown" | "slopeUp" | "flat" | "gauge";
  tint: string;
  color: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-center" style={{ gap: u(12) }}>
      <span
        className="flex shrink-0 items-center justify-center"
        style={{ width: u(40), height: u(40), borderRadius: u(12), background: tint, color }}
      >
        <Icon name={icon} size={22} />
      </span>
      <div className="min-w-0">
        <p style={{ fontSize: u(17), fontWeight: 900, lineHeight: 1.3 }}>{title}</p>
        <p style={{ fontSize: u(14), color: "#c9cfd8", lineHeight: 1.4 }}>{body}</p>
      </div>
    </div>
  );
}

/** 站點介紹：站牌、這一站的天氣、坡度、進站速度和目標時間 */
export function Briefing({
  snapshot,
  route,
  text,
  locale,
  onDepart,
}: Common & { snapshot: Snapshot; route: Route; onDepart(): void }) {
  const { stop, index } = snapshot;
  const name = stationName(stop.station, locale);
  const neighbour = (offset: number, fallback: string) => {
    const other = route.stops[index + offset];
    return other ? stationName(other.station, locale).name : fallback;
  };
  const kind = gradeKind(stop.grade);
  return (
    <div className="absolute inset-0 overflow-hidden" data-testid="briefing" data-no-brake>
      {/* eslint-disable-next-line @next/next/no-img-element -- 遊戲內的背景圖，尺寸跟著遊戲框縮放 */}
      <img
        src={`/games/precise-stop/0.1.0/${stationBackground(stop.station)}`}
        alt=""
        className="absolute inset-0 size-full object-cover"
        style={{ objectPosition: "40% 50%" }}
      />
      {stop.rain && <div className="ps-rain absolute inset-0" />}
      <div className="absolute inset-0" style={{ background: "rgba(16,19,26,0.3)" }} />

      <div
        className="absolute flex flex-col items-center"
        style={{ left: u(24), right: u(24), top: u(24), gap: u(12) }}
      >
        <span style={{ ...pill("#1d3a8f"), fontSize: u(15) }}>
          {fmt(text.hud.station, { n: index + 1, total: STATIONS_PER_RUN })}
        </span>
        <div
          className="flex max-w-full flex-col items-center bg-white text-sign"
          style={{
            border: `${u(4)} solid #1d3a8f`,
            borderRadius: u(14),
            padding: `${u(6)} ${u(32)} ${u(6)}`,
          }}
        >
          <span
            className="whitespace-nowrap"
            style={{
              fontSize: u(name.name.length > 6 ? 30 : 44),
              fontWeight: 900,
              lineHeight: 1.2,
              letterSpacing: /^[㐀-鿿]+$/.test(name.name) ? u(10) : undefined,
              marginRight: /^[㐀-鿿]+$/.test(name.name) ? u(-10) : undefined,
            }}
            data-testid="briefing-station"
          >
            {name.name}
          </span>
          <span style={{ fontSize: u(14), fontWeight: 700, letterSpacing: u(2), color: "#4a5263" }}>
            {name.sub}
          </span>
          <div className="w-full bg-sign" style={{ height: u(6), borderRadius: u(3), marginTop: u(2) }} />
          <span
            className="whitespace-nowrap"
            style={{ marginTop: u(4), fontSize: u(13), fontWeight: 700, color: "#4a5263" }}
          >
            {fmt(text.briefing.neighbours, {
              previous: neighbour(-1, text.briefing.origin),
              next: neighbour(1, text.briefing.terminal),
            })}
          </span>
        </div>
      </div>

      <div
        className="absolute flex flex-col"
        style={{
          left: u(24),
          right: u(24),
          top: u(214),
          padding: `${u(14)} ${u(18)}`,
          borderRadius: u(18),
          background: "rgba(16,19,26,0.9)",
          gap: u(10),
        }}
      >
        <p style={{ fontSize: u(16), fontWeight: 900, color: "#ffc83d" }}>{text.briefing.heading}</p>
        {stop.rain ? (
          <BriefRow icon="rain" tint="#2a3a5c" color="#8fb0ff" title={text.briefing.rainTitle} body={text.briefing.rainBody} />
        ) : (
          <BriefRow icon="sun" tint="#3a3420" color="#ffc83d" title={text.briefing.clearTitle} body={text.briefing.clearBody} />
        )}
        {kind === "flat" ? (
          <BriefRow icon="flat" tint="#26303f" color="#c9cfd8" title={text.briefing.flatTitle} body={text.briefing.flatBody} />
        ) : (
          <BriefRow
            icon={kind === "down" ? "slopeDown" : "slopeUp"}
            tint="#4a2a1c"
            color="#ff9a6b"
            title={gradeLabel(stop, text)}
            body={kind === "down" ? text.briefing.downBody : text.briefing.upBody}
          />
        )}
        <BriefRow
          icon="gauge"
          tint="#3a3420"
          color="#ffc83d"
          title={fmt(text.briefing.speed, {
            speed: stop.speedKmh,
            time: formatDecimal(stop.targetTime, locale),
          })}
          body={fmt(text.briefing.speedBody, { distance: formatNumber(stop.startDistance, locale) })}
        />
      </div>

      <div className="absolute flex flex-col" style={{ left: u(24), right: u(24), bottom: u(16), gap: u(6) }}>
        <button
          type="button"
          onClick={onDepart}
          data-testid="depart-button"
          className="cursor-pointer font-black text-white"
          style={{
            minHeight: u(58),
            borderRadius: u(18),
            background: "#cc4409",
            boxShadow: `0 ${u(5)} 0 #a83606`,
            fontSize: u(22),
          }}
        >
          {text.briefing.depart}
        </button>
        <p className="hidden text-center md:block" style={{ fontSize: u(13), color: "#e3e7ec" }}>
          {text.briefing.departHint}
        </p>
      </div>
    </div>
  );
}

const row = { display: "flex", justifyContent: "space-between", gap: u(8) } as const;

/** 判定結果：誤差、停車分、準點、連擊、本站得分 */
export function JudgedPanel({
  snapshot,
  route,
  text,
  locale,
  onNext,
}: Common & { snapshot: Snapshot; route: Route; onNext(): void }) {
  const result = snapshot.results.at(-1);
  if (!result) return null;
  const stop = route.stops[snapshot.index];
  const color = judgementColor[result.judgement];
  const emergency = snapshot.train.emergency;
  const title =
    result.judgement === "miss"
      ? result.error > 0
        ? text.judgement.overrun
        : text.judgement.short
      : text.judgement[result.judgement];
  const exact = Math.round(Math.abs(result.error) * 100) === 0;
  const detail = emergency
    ? text.judged.emergency
    : exact
      ? text.judged.exact
      : fmt(result.error > 0 ? text.judged.after : text.judged.before, {
          value: formatError(result.error, locale),
        });
  const nextStop = route.stops[snapshot.index + 1];
  const elapsed = formatDecimal(snapshot.train.elapsed, locale);
  const target = formatDecimal(stop.targetTime, locale);
  const muted = { color: "#aab3c5" };
  return (
    <div
      data-testid="judged-panel"
      data-judgement={result.judgement}
      data-no-brake
      className="absolute inset-x-0 bottom-0 flex flex-col"
      style={{ top: `${(340 / 560) * 100}%`, padding: `${u(10)} ${u(18)} ${u(14)}`, gap: u(6) }}
    >
      <div className="flex items-center justify-between" style={{ gap: u(10) }}>
        <div className="flex min-w-0 flex-col">
          <span style={{ fontSize: u(title.length > 8 ? 26 : 34), fontWeight: 900, lineHeight: 1.1, color: color.text }}>
            {title}
          </span>
          <span style={{ fontSize: u(14), fontWeight: 700, color: "#e3e7ec", lineHeight: 1.35 }}>
            {detail}
            {result.judgement === "miss" && !emergency && `（${text.judged.missNote}）`}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span style={{ fontSize: u(13), fontWeight: 700, ...muted }}>{text.judged.stationScore}</span>
          <span
            className="tabular-nums"
            style={{ fontSize: u(34), fontWeight: 900, lineHeight: 1.1 }}
            data-testid="station-score"
          >
            {formatNumber(result.score, locale)}
          </span>
        </div>
      </div>
      <div
        className="flex flex-col tabular-nums"
        style={{
          borderRadius: u(14),
          background: "#1b2030",
          padding: `${u(5)} ${u(14)}`,
          gap: u(2),
          fontSize: u(14),
          fontWeight: 700,
          lineHeight: 1.35,
        }}
      >
        <div style={row}>
          <span style={muted}>{text.judged.stopScore}</span>
          <span>{formatNumber(result.stopScore, locale)}</span>
        </div>
        <div style={row}>
          <span style={muted}>
            {result.overtime > 0
              ? fmt(text.judged.overtime, { seconds: formatDecimal(result.overtime, locale) })
              : fmt(text.judged.onTime, { elapsed, target })}
          </span>
          <span style={{ color: result.penalty > 0 ? "#ff8a57" : undefined }}>
            {result.penalty > 0 ? `−${formatNumber(result.penalty, locale)}` : "±0"}
          </span>
        </div>
        <div style={row}>
          <span style={muted}>{text.judged.combo}</span>
          <span>
            {result.streak > 0
              ? `×${result.multiplier.toFixed(1)}${
                  nextStop
                    ? `　${fmt(text.judged.comboNext, { value: comboMultiplier(result.streak + 1).toFixed(1) })}`
                    : ""
                }`
              : snapshot.streak > 0
                ? `×${comboMultiplier(snapshot.streak).toFixed(1)} → ${text.judged.comboBroken}`
                : "×1.0"}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onNext}
        data-testid="next-button"
        className="mt-auto cursor-pointer font-black text-white"
        style={{
          minHeight: u(50),
          borderRadius: u(18),
          background: "#cc4409",
          boxShadow: `0 ${u(5)} 0 #a83606`,
          fontSize: u(20),
        }}
      >
        {nextStop
          ? fmt(text.judged.nextStation, { name: stationName(nextStop.station, locale).name })
          : text.judged.toResults}
      </button>
    </div>
  );
}

/** 五站結算 */
export function FinalPanel({
  snapshot,
  route,
  outcome,
  text,
  locale,
  onShare,
  onAgain,
  onChangeMode,
}: Common & {
  snapshot: Snapshot;
  route: Route;
  outcome: SaveOutcome | null;
  onShare(): void;
  onAgain(): void;
  onChangeMode(): void;
}) {
  const modeName = route.mode === "daily" ? text.modes.daily : text.modes.free;
  const lastStop = route.stops.at(-1);
  const cells = `${u(96)} minmax(0, auto) minmax(0, 1fr) auto`;
  return (
    <div
      data-testid="final-panel"
      data-no-brake
      className="absolute inset-0 flex flex-col bg-canvas"
      style={{ padding: `${u(16)} ${u(20)} ${u(16)}`, gap: u(10) }}
    >
      <div className="flex items-center justify-between" style={{ gap: u(8) }}>
        <span style={pill("#cc4409")}>{modeName}</span>
        {lastStop && (
          <span className="truncate" style={{ fontSize: u(14), fontWeight: 700, color: "#aab3c5" }}>
            {fmt(text.final.terminal, { name: stationName(lastStop.station, locale).name })}
          </span>
        )}
      </div>
      <div className="flex flex-col items-center" style={{ gap: u(2) }}>
        <span style={{ fontSize: u(15), fontWeight: 700, color: "#aab3c5" }}>{text.final.total}</span>
        <span
          className="tabular-nums"
          style={{ fontSize: u(54), fontWeight: 900, lineHeight: 1.05 }}
          data-testid="final-total"
          data-total={snapshot.total}
        >
          <CountUp value={snapshot.total} locale={locale} />
        </span>
        {outcome && (
          <span
            data-testid="record-note"
            data-new-record={outcome.isNewRecord}
            className="text-center"
            style={{
              ...pill(outcome.isNewRecord ? "#ffc83d" : "#1b2030", outcome.isNewRecord ? "#14171f" : "#c9cfd8"),
              marginTop: u(4),
              whiteSpace: "normal",
            }}
          >
            {outcome.isNewRecord
              ? `${text.final.newRecord} ${
                  outcome.previousBest === null
                    ? fmt(text.final.firstRecord, { mode: modeName })
                    : fmt(text.final.recordChange, {
                        mode: modeName,
                        from: formatNumber(outcome.previousBest, locale),
                        to: formatNumber(snapshot.total, locale),
                      })
                }`
              : fmt(text.final.best, {
                  mode: modeName,
                  score: formatNumber(outcome.previousBest ?? snapshot.total, locale),
                })}
          </span>
        )}
      </div>
      <ol
        aria-label={text.final.stationsLabel}
        className="flex flex-col"
        style={{ borderRadius: u(16), background: "#1b2030", padding: `${u(4)} ${u(14)}` }}
      >
        {snapshot.results.map((result, index) => {
          const color = judgementColor[result.judgement];
          return (
            <li
              key={route.stops[index].station}
              className="grid items-baseline tabular-nums"
              style={{
                gridTemplateColumns: cells,
                gap: u(8),
                padding: `${u(5)} 0`,
                borderTop: index ? "1px solid #2a3040" : undefined,
                fontSize: u(14),
                fontWeight: 700,
              }}
            >
              <span className="truncate">{stationName(route.stops[index].station, locale).name}</span>
              <span style={{ color: color.text }}>{text.judgement[result.judgement]}</span>
              <span className="truncate" style={{ color: "#c9cfd8" }}>
                {Math.round(Math.abs(result.error) * 100) === 0 ? "" : result.error > 0 ? "+" : "−"}
                {formatError(result.error, locale)}
                {result.multiplier > 1 && ` · ×${result.multiplier.toFixed(1)}`}
                {result.penalty > 0 && ` · −${result.penalty}`}
              </span>
              <span className="text-right">{formatNumber(result.score, locale)}</span>
            </li>
          );
        })}
      </ol>
      {outcome && !outcome.saved && (
        <p className="text-center" style={{ fontSize: u(12), color: "#aab3c5", lineHeight: 1.4 }} data-testid="not-saved">
          {text.final.notSaved}
        </p>
      )}
      <div className="mt-auto flex flex-col" style={{ gap: u(9) }}>
        <button
          type="button"
          onClick={onShare}
          data-testid="share-button"
          className="flex cursor-pointer items-center justify-center font-black text-ink"
          style={{
            minHeight: u(52),
            borderRadius: u(16),
            background: "#ffc83d",
            boxShadow: `0 ${u(4)} 0 #b8860b`,
            fontSize: u(19),
            gap: u(8),
          }}
        >
          <Icon name="share" size={20} />
          {text.final.share}
        </button>
        <div className="flex" style={{ gap: u(10) }}>
          <button
            type="button"
            onClick={onAgain}
            data-testid="again-button"
            className="flex-1 cursor-pointer font-black text-white"
            style={{
              minHeight: u(48),
              borderRadius: u(16),
              background: "#cc4409",
              boxShadow: `0 ${u(4)} 0 #a83606`,
              fontSize: u(17),
            }}
          >
            {text.final.again}
          </button>
          <button
            type="button"
            onClick={onChangeMode}
            data-testid="change-mode-button"
            className="flex-1 cursor-pointer font-black text-white"
            style={{
              minHeight: u(48),
              borderRadius: u(16),
              border: `${u(2)} solid #c9cfd8`,
              fontSize: u(17),
            }}
          >
            {text.final.changeMode}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 總分從 0 跑到最終分數，約 1.2 秒；系統要求減少動態時直接顯示 */
function CountUp({ value, locale }: { value: number; locale: Locale }) {
  const [shown, setShown] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? value
      : 0,
  );
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1200);
      setShown(Math.round(value * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{formatNumber(shown, locale)}</>;
}

export function PauseDialog({
  snapshot,
  text,
  locale,
  onResume,
  onRestart,
  onBack,
}: Common & { snapshot: Snapshot; onResume(): void; onRestart(): void; onBack(): void }) {
  const name = stationName(snapshot.stop.station, locale).name;
  const key = { fontSize: u(13), fontWeight: 700, padding: `${u(2)} ${u(8)}`, borderRadius: u(6) };
  return (
    <div className="absolute inset-0" data-no-brake data-testid="pause-dialog">
      <div className="absolute inset-0" style={{ background: "rgba(16,19,26,0.72)" }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={text.pause.title}
        className="absolute flex flex-col bg-white text-ink"
        style={{ left: u(40), right: u(40), top: u(100), padding: `${u(22)} ${u(22)}`, borderRadius: u(22), gap: u(12) }}
      >
        <p className="text-center text-sign" style={{ fontSize: u(28), fontWeight: 900 }}>
          {text.pause.title}
        </p>
        <p className="text-center text-muted" style={{ fontSize: u(14) }}>
          {fmt(text.pause.status, {
            n: snapshot.index + 1,
            name,
            distance: formatDecimal(Math.max(0, snapshot.train.distance), locale),
          })}
        </p>
        <button
          type="button"
          autoFocus
          onClick={onResume}
          data-testid="resume-button"
          className="flex cursor-pointer items-center justify-center font-black text-white"
          style={{
            minHeight: u(56),
            borderRadius: u(16),
            background: "#cc4409",
            boxShadow: `0 ${u(4)} 0 #a83606`,
            fontSize: u(20),
            gap: u(10),
          }}
        >
          {text.pause.resume}
          <span className="hidden md:inline" style={{ ...key, background: "rgba(255,255,255,0.2)" }}>
            P／Esc
          </span>
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="flex cursor-pointer items-center justify-center font-black text-sign"
          style={{ minHeight: u(52), borderRadius: u(16), border: `${u(2)} solid #1d3a8f`, fontSize: u(18), gap: u(10) }}
        >
          {text.pause.restart}
          <span className="hidden bg-sign-tint md:inline" style={key}>
            R
          </span>
        </button>
        <button
          type="button"
          onClick={onBack}
          className="cursor-pointer font-bold text-muted"
          style={{ minHeight: u(48), fontSize: u(16) }}
        >
          {text.pause.back}
        </button>
      </div>
      <p
        className="absolute text-center"
        style={{ left: u(24), right: u(24), bottom: u(22), fontSize: u(14), color: "#e3e7ec", lineHeight: 1.6 }}
      >
        {text.pause.note}
      </p>
    </div>
  );
}

function WeatherIcon({ rain }: { rain: boolean }) {
  return (
    <span style={{ color: rain ? "#8fb0ff" : "#ffc83d" }} className="inline-flex">
      <Icon name={rain ? "rain" : "sun"} size={15} />
    </span>
  );
}

function shortGrade(stop: RouteStop, text: GameText) {
  const kind = gradeKind(stop.grade);
  return kind === "flat" ? text.grade.flat : kind === "up" ? text.grade.up : text.grade.down;
}

/** 估算文字寬度（以一個漢字寬為 1）：漢字、假名、韓文算 1，其他字母約 0.6 */
function textUnits(value: string): number {
  return [...value].reduce((sum, char) => sum + (char.charCodeAt(0) > 0x2e7f ? 1 : 0.6), 0);
}

/** 站名、坡度只用漢字或假名的語言，5 站橫排在手機上也放得下 */
const COMPACT_SCRIPT: Locale[] = ["zh-TW", "zh-CN", "ja"];

function Dot({ done, active, size }: { done: boolean; active: boolean; size: number }) {
  return (
    <span
      className="box-border block shrink-0 rounded-full border-4"
      style={{
        width: size,
        height: size,
        background: done || active ? "#ffc83d" : "#fff",
        borderColor: active ? "#cc4409" : "#152b6b",
      }}
    />
  );
}

/**
 * 路線條：5 站橫排，標出天氣、坡度、進站速度。
 * 介紹頁的看板用它預覽今日路線（detailed），遊戲中用它顯示目前進度。
 *
 * 音譯的站名（Sakurazaka、사쿠라자카）在手機上一欄放不下：
 * - 看板：這些語言在手機寬度改成一站一行的清單
 * - 遊戲中：站名上下交錯，每個站名可以用到兩欄的寬度
 */
export function RouteStrip({
  route,
  current = -1,
  detailed,
  text,
  locale,
}: Common & { route: Route; current?: number; detailed: boolean }) {
  const names = route.stops.map((stop) => stationName(stop.station, locale).name);
  const status = (index: number) => ({ done: current >= 0 && index < current, active: index === current });

  if (detailed) {
    const horizontal = <RouteRow route={route} names={names} current={current} detailed text={text} />;
    if (COMPACT_SCRIPT.includes(locale)) return horizontal;
    return (
      <>
        <div className="hidden sm:block">{horizontal}</div>
        <ol className="flex flex-col sm:hidden" data-testid="route-strip">
          {route.stops.map((stop, index) => (
            <li
              key={stop.station}
              aria-current={status(index).active ? "step" : undefined}
              className="relative flex min-h-8 items-center gap-2.5 px-1.5"
            >
              {index > 0 && (
                <span aria-hidden="true" className="absolute left-[15px] top-0 h-1/2 w-1 -translate-x-1/2 bg-[#3a4f8f]" />
              )}
              {index < route.stops.length - 1 && (
                <span aria-hidden="true" className="absolute bottom-0 left-[15px] h-1/2 w-1 -translate-x-1/2 bg-[#3a4f8f]" />
              )}
              <span className="relative">
                <Dot {...status(index)} size={18} />
              </span>
              <span className="min-w-0 flex-1 truncate font-extrabold">{names[index]}</span>
              <span className="flex shrink-0 items-center gap-1 text-sm text-[#c9cfd8]">
                <WeatherIcon rain={stop.rain} />
                <span className="sr-only">{stop.rain ? text.weather.rain : text.weather.clear}・</span>
                {shortGrade(stop, text)}
              </span>
              <span className="w-[4.5rem] shrink-0 text-right text-sm tabular-nums text-[#aab3c5]">
                {stop.speedKmh} km/h
              </span>
            </li>
          ))}
        </ol>
      </>
    );
  }

  return <RouteRow route={route} names={names} current={current} detailed={false} text={text} />;
}

function RouteRow({
  route,
  names,
  current,
  detailed,
  text,
}: {
  route: Route;
  names: string[];
  current: number;
  detailed: boolean;
  text: GameText;
}) {
  // 手機一欄約 62 px，放得下 4 個 14 px 的漢字；更長就上下交錯
  const stagger = !detailed && Math.max(...names.map(textUnits)) > 4.2;
  const dot = detailed ? 22 : 18;
  const label = 20;
  const lineTop = (stagger ? label : 0) + dot / 2 - 2;
  return (
    <ol className="relative grid grid-cols-5" data-testid="route-strip">
      <span
        aria-hidden="true"
        className="absolute h-1 rounded-full bg-[#3a4f8f]"
        style={{ left: "10%", right: "10%", top: lineTop }}
      />
      {current > 0 && (
        <span
          aria-hidden="true"
          className="absolute h-1 rounded-full bg-edge"
          style={{ left: "10%", width: `${Math.min(current, route.stops.length - 1) * 20}%`, top: lineTop }}
        />
      )}
      {route.stops.map((stop, index) => {
        const done = current >= 0 && index < current;
        const active = index === current;
        const name = (
          <span
            className={`font-extrabold ${detailed ? "text-[15px]" : "text-sm"} ${
              stagger
                ? // 交錯時站名可以超出自己這一欄，最多用到兩欄寬
                  `absolute w-[200%] truncate leading-5 ${
                    // 頭尾兩站往內對齊，不要超出路線條
                    index === 0
                      ? "left-0 text-left"
                      : index === route.stops.length - 1
                        ? "right-0 text-right"
                        : "left-1/2 -translate-x-1/2"
                  }`
                : "max-w-full truncate"
            }`}
            style={{
              color: active ? "#ffc83d" : "#fff",
              ...(stagger ? (index % 2 ? { top: 0 } : { bottom: 0 }) : {}),
            }}
          >
            {names[index]}
          </span>
        );
        return (
          <li
            key={stop.station}
            aria-current={active ? "step" : undefined}
            className="relative flex min-w-0 flex-col items-center gap-0.5 px-0.5 text-center"
            style={stagger ? { paddingTop: label, paddingBottom: label } : undefined}
          >
            <Dot done={done} active={active} size={dot} />
            {name}
            {detailed && (
              <>
                <span className="flex items-center gap-1 text-xs text-[#c9cfd8]">
                  <WeatherIcon rain={stop.rain} />
                  <span className="sr-only">{stop.rain ? text.weather.rain : text.weather.clear}・</span>
                  {shortGrade(stop, text)}
                </span>
                <span className="text-xs tabular-nums text-[#aab3c5]">{stop.speedKmh} km/h</span>
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** 電腦遊戲畫面左側的本局路線：各站狀態與得分 */
export function RouteList({ snapshot, route, text, locale }: Common & { snapshot: Snapshot; route: Route }) {
  return (
    <ol className="flex flex-col gap-1">
      {route.stops.map((stop, index) => {
        const result = snapshot.results[index];
        const active = index === snapshot.index && snapshot.phase !== "final";
        return (
          <li
            key={stop.station}
            aria-current={active ? "step" : undefined}
            className="flex items-center gap-3 rounded-xl px-2.5 py-2"
            style={active ? { background: "rgba(255,200,61,0.14)", boxShadow: "inset 0 0 0 2px #ffc83d" } : undefined}
          >
            <span
              className="box-border size-[22px] shrink-0 rounded-full border-4"
              style={{
                background: result || active ? "#ffc83d" : "transparent",
                borderColor: active ? "#cc4409" : result ? "#ffc83d" : "#4a5263",
              }}
            />
            <span className="min-w-0 flex-1">
              <span
                className="block truncate font-extrabold"
                style={{ color: active ? "#ffc83d" : result ? "#fff" : "#aab3c5" }}
              >
                {stationName(stop.station, locale).name}
              </span>
              <span className="flex items-center gap-1 text-xs text-[#aab3c5]">
                <WeatherIcon rain={stop.rain} />
                {shortGrade(stop, text)} · {stop.speedKmh} km/h
              </span>
            </span>
            <span
              className="text-sm font-extrabold tabular-nums"
              style={{ color: result ? judgementColor[result.judgement].text : "#6b7386" }}
            >
              {result ? formatNumber(result.score, locale) : active && snapshot.phase === "running" ? text.stage.running : "—"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
