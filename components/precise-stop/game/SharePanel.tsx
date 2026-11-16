"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { Route } from "@/lib/games/precise-stop/route";
import type { StopResult } from "@/lib/games/precise-stop/scoring";
import { encodeRun, toSharedRun } from "@/lib/games/precise-stop/share-code";
import { fmt, formatNumber } from "@/lib/i18n/format";
import { localePath, type Locale } from "@/lib/i18n/locales";
import { useMediaQuery } from "@/lib/use-client";
import type { GameText } from "./shared";

type Props = {
  text: GameText;
  locale: Locale;
  route: Route;
  results: StopResult[];
  total: number;
  newRecord: boolean;
  dateKey: string;
  onClose(): void;
};

type Card = { status: "loading" } | { status: "ready"; url: string; file: File } | { status: "error" };

/**
 * 分享成績。成績圖由伺服器依成績代碼產生（和社群預覽圖是同一張），
 * 手機優先用系統分享選單帶出圖片、文字和連結；電腦提供各平台的分享按鈕。
 */
export function SharePanel({ text, locale, route, results, total, newRecord, dateKey, onClose }: Props) {
  const [loaded, setLoaded] = useState<{ key: string; card: Card } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [copied, setCopied] = useState(false);
  const wide = useMediaQuery("(min-width: 768px)");
  const [canShareFiles, setCanShareFiles] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const path = useMemo(() => {
    const code = encodeRun(
      toSharedRun({
        mode: route.mode,
        dateKey,
        newRecord,
        stations: route.stops.map((stop) => stop.station),
        results,
      }),
    );
    return localePath(locale, `/games/precise-stop/r/${code}`);
  }, [route, dateKey, newRecord, results, locale]);

  // 換了成績或按了重試，在新的圖回來之前都算載入中
  const requestKey = `${path}|${attempt}`;
  const card: Card = loaded?.key === requestKey ? loaded.card : { status: "loading" };

  const shareText = fmt(text.share.text, { score: formatNumber(total, locale) });
  const modeName = route.mode === "daily" ? text.modes.daily : text.modes.free;

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    fetch(`${path}/card`)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const file = new File([blob], "precise-stop.png", { type: "image/png" });
        objectUrl = URL.createObjectURL(blob);
        setLoaded({ key: requestKey, card: { status: "ready", url: objectUrl, file } });
        try {
          setCanShareFiles(
            typeof navigator.share === "function" &&
              typeof navigator.canShare === "function" &&
              navigator.canShare({ files: [file] }),
          );
        } catch {
          setCanShareFiles(false);
        }
      })
      .catch(() => !cancelled && setLoaded({ key: requestKey, card: { status: "error" } }));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, requestKey]);

  const absoluteUrl = () => new URL(path, window.location.origin).toString();

  async function shareNative() {
    if (card.status !== "ready") return;
    try {
      await navigator.share({ files: [card.file], text: shareText, url: absoluteUrl() });
    } catch {
      // 使用者取消分享不算錯誤
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(absoluteUrl());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function openShare(target: "line" | "facebook" | "x") {
    const url = encodeURIComponent(absoluteUrl());
    const message = encodeURIComponent(shareText);
    const href = {
      line: `https://social-plugins.line.me/lineit/share?url=${url}&text=${message}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      x: `https://twitter.com/intent/tweet?text=${message}&url=${url}`,
    }[target];
    window.open(href, "_blank", "noopener,noreferrer,width=640,height=640");
  }

  const ready = card.status === "ready";
  const showSocial = wide || !canShareFiles;
  const outline =
    "flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-2xl border-2 border-line px-2 text-center text-[15px] leading-tight font-bold text-ink disabled:cursor-not-allowed disabled:opacity-50";
  const social =
    "flex min-h-13 cursor-pointer items-center gap-3 rounded-2xl px-4 text-left text-lg font-extrabold text-white";

  return (
    <div className="absolute inset-0 z-10 flex items-end justify-center md:items-center" data-no-brake>
      <div className="absolute inset-0 bg-canvas/75" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={text.share.title}
        data-testid="share-panel"
        className="ps-sheet relative flex max-h-full w-full flex-col gap-3 overflow-auto rounded-t-3xl bg-card px-5 pb-5 pt-2 text-ink md:w-[780px] md:max-w-[calc(100vw-3rem)] md:flex-row md:gap-7 md:rounded-3xl md:p-7"
      >
        <div className="flex items-center justify-between md:hidden">
          <h2 className="text-xl font-extrabold text-sign">{text.share.title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={text.share.close}
            className="flex size-11 cursor-pointer items-center justify-center rounded-full text-muted"
          >
            <Icon name="close" size={22} />
          </button>
        </div>

        <div className="mx-auto aspect-[4/5] w-[min(56vw,216px)] shrink-0 overflow-hidden rounded-2xl bg-canvas shadow-[0_6px_16px_rgb(16_19_26/0.25)] md:mx-0 md:w-[330px]">
          {card.status === "ready" && (
            // eslint-disable-next-line @next/next/no-img-element -- 成績圖是即時產生的，不走圖片最佳化
            <img
              src={card.url}
              alt={fmt(text.share.cardAlt, { mode: modeName, score: formatNumber(total, locale) })}
              className="size-full object-cover"
              data-testid="share-card"
            />
          )}
          {card.status === "loading" && (
            <div className="flex size-full flex-col items-center justify-center gap-2 text-white" role="status">
              <span className="ps-spinner size-8 rounded-full border-4 border-white/20 border-t-edge" />
              <span className="px-3 text-center text-sm">{text.share.preparing}</span>
            </div>
          )}
          {card.status === "error" && (
            <div className="flex size-full flex-col items-center justify-center gap-3 p-3 text-center text-white" role="alert">
              <span className="text-sm">{text.share.failed}</span>
              <button
                type="button"
                onClick={() => setAttempt((value) => value + 1)}
                className="min-h-11 cursor-pointer rounded-full bg-express px-5 font-bold"
              >
                {text.stage.retry}
              </button>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <div className="hidden items-center justify-between md:flex">
            <h2 className="text-2xl font-extrabold text-sign">{text.share.title}</h2>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="min-h-11 cursor-pointer rounded-lg border border-line px-3 text-sm text-muted"
            >
              {text.share.escClose}
            </button>
          </div>

          {canShareFiles && (
            <button
              type="button"
              onClick={shareNative}
              disabled={!ready}
              data-testid="share-native"
              className="press flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-express text-lg font-extrabold text-white shadow-[0_4px_0_var(--express-deep)] disabled:opacity-50"
            >
              <Icon name="share" size={20} />
              {text.share.shareTo}
            </button>
          )}

          {showSocial && (
            <>
              <button type="button" onClick={() => openShare("line")} className={`${social} bg-signal`} data-testid="share-line">
                <span className="flex size-8 items-center justify-center rounded-lg bg-white/20 text-[11px]">LINE</span>
                {text.share.line}
              </button>
              <button type="button" onClick={() => openShare("facebook")} className={`${social} bg-sign`} data-testid="share-facebook">
                <span className="flex size-8 items-center justify-center rounded-lg bg-white/20 text-sm">f</span>
                {text.share.facebook}
              </button>
              <button type="button" onClick={() => openShare("x")} className={`${social} bg-ink`} data-testid="share-x">
                <span className="flex size-8 items-center justify-center rounded-lg bg-white/20 text-sm">X</span>
                {text.share.x}
              </button>
            </>
          )}

          <div className="flex gap-2.5">
            {ready ? (
              <a href={card.url} download="precise-stop.png" className={outline} data-testid="share-download">
                <Icon name="download" size={18} />
                {wide ? text.share.download : text.share.save}
              </a>
            ) : (
              <button type="button" disabled className={outline}>
                <Icon name="download" size={18} />
                {wide ? text.share.download : text.share.save}
              </button>
            )}
            <button type="button" onClick={copyLink} className={outline} data-testid="share-copy">
              <Icon name={copied ? "check" : "link"} size={18} />
              <span aria-live="polite">{copied ? text.share.copied : text.share.copy}</span>
            </button>
          </div>

          {showSocial && (
            <p className="mt-auto rounded-xl bg-edge-tint px-3 py-2.5 text-sm leading-relaxed">
              {text.share.instagramNote}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
