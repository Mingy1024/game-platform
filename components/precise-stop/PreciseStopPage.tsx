import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { AdSlot } from "@/components/ads/AdSlot";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Container } from "@/components/layout/Container";
import { getCategoriesOfGame, getGameBySlug } from "@/lib/catalog/catalog";
import { localizeCategory } from "@/lib/catalog/localize";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localePath, type Locale } from "@/lib/i18n/locales";
import { DepartureBoard } from "./DepartureBoard";
import { Experience } from "./Experience";
import { PlayCountChip } from "./PlayCountChip";
import { RecordsCard } from "./RecordsCard";

const HERO = "/games/precise-stop/0.1.0/hero.webp";

const judgementStyle = {
  perfect: "text-signal",
  great: "text-sign",
  good: "text-ink",
  fair: "text-muted",
  miss: "text-express",
} as const;

const scoreRange = {
  perfect: "1,000",
  great: "990–850",
  good: "850–500",
  fair: "500–100",
  miss: "0",
} as const;

const card = "rounded-[18px] border border-line bg-card p-5";
const cardTitle = "text-xl font-extrabold text-ink";

/**
 * 精準停車的介紹頁。按下出發看板的「出發」後，整頁換成遊戲畫面（網址不變）。
 * banner：從朋友的成績連結進來時，顯示對方分數的那一行。
 */
export function PreciseStopPage({ locale, banner }: { locale: Locale; banner?: ReactNode }) {
  const dict = getDictionary(locale);
  const text = dict.preciseStop;
  const game = getGameBySlug("precise-stop");
  const categories = game
    ? getCategoriesOfGame(game).map((category) => localizeCategory(category, dict))
    : [];
  const keys = text.howTo.keys;
  const keyChips = [
    [keys.touch, keys.touchValue],
    [keys.desktop, keys.desktopValue],
    [keys.pause, "P／Esc"],
    [keys.restart, "R"],
    [keys.fullscreen, "F"],
  ];

  return (
    <Experience locale={locale} text={text} nav={dict.nav} account={dict.account}>
      <Container className="py-5 sm:py-8">
        <Breadcrumb
          label={dict.breadcrumb.label}
          items={[
            { label: dict.breadcrumb.home, href: localePath(locale, "/") },
            { label: dict.nav.games, href: "/games" },
            { label: text.title },
          ]}
        />

        <header className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-2xl font-extrabold text-sign sm:text-3xl">{text.title}</h1>
          <p className="basis-full text-muted lg:basis-auto lg:text-lg">{text.lead}</p>
          <ul className="flex flex-wrap items-center gap-2 lg:ml-auto">
            {categories.map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/categories/${category.slug}`}
                  className="flex min-h-11 items-center rounded-full bg-sign-tint px-4 font-semibold text-sign hover:bg-edge-tint"
                >
                  {category.name}
                </Link>
              </li>
            ))}
            <li className="empty:hidden">
              <PlayCountChip />
            </li>
          </ul>
        </header>

        {banner}

        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-6">
          <div className="relative h-[220px] shrink-0 overflow-hidden rounded-[18px] bg-canvas sm:h-[300px] lg:h-auto lg:min-h-[560px] lg:w-[420px]">
            <Image
              src={HERO}
              alt={text.heroAlt}
              fill
              priority
              unoptimized
              sizes="(min-width: 1024px) 420px, 100vw"
              className="object-cover object-[50%_52%]"
            />
            <span className="absolute bottom-3.5 left-3.5 rounded-full bg-canvas/80 px-3 py-1 text-sm font-bold text-white">
              {text.chip}
            </span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <DepartureBoard />
            <RecordsCard />
          </div>
        </div>

        <section aria-labelledby="howto-title" className={`mt-7 ${card}`}>
          <h2 id="howto-title" className={cardTitle}>
            {text.howTo.title}
          </h2>
          {/* 軌道路線圖：三個停靠點就是三個步驟 */}
          <ol className="relative mt-4 flex flex-col gap-4 pl-9 md:grid md:grid-cols-3 md:gap-6 md:pl-0 md:pt-9">
            <span
              aria-hidden="true"
              className="absolute bottom-2 left-[11px] top-2 w-1 rounded-full bg-[repeating-linear-gradient(var(--muted)_0_10px,var(--line)_10px_16px)] md:inset-x-3 md:bottom-auto md:top-[11px] md:h-1 md:w-auto md:bg-[repeating-linear-gradient(90deg,var(--muted)_0_14px,var(--line)_14px_22px)]"
            />
            {text.howTo.steps.map((step, index) => (
              <li key={step.title} className="relative">
                <span
                  aria-hidden="true"
                  className={`absolute -left-9 top-0 box-border size-[26px] rounded-full border-4 md:-top-9 md:left-0 ${
                    index === 2 ? "border-signal bg-signal" : "border-sign bg-card"
                  }`}
                />
                <h3 className="text-lg font-extrabold">{step.title}</h3>
                <p className="mt-0.5 text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
          <ul className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4 text-sm">
            {keyChips.map(([label, value]) => (
              <li
                key={label}
                className="flex items-center gap-1.5 rounded-full border border-line bg-platform px-3 py-1.5"
              >
                <strong>{label}</strong>
                <span className="text-muted">{value}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 唯一的廣告版位：放在玩法和計分之間，離出發按鈕一整個區塊；遊戲畫面裡沒有廣告 */}
        <AdSlot slot="game-guide" className="mt-7" label={dict.ads.label} mockText={dict.ads.mock} />

        <div className="mt-7 grid gap-4 md:grid-cols-2">
          <section aria-labelledby="scoring-title" className={card}>
            <h2 id="scoring-title" className={cardTitle}>
              {text.scoring.title}
            </h2>
            <table className="mt-3 w-full">
              <tbody>
                {(Object.keys(judgementStyle) as (keyof typeof judgementStyle)[]).map((key) => (
                  <tr key={key} className="border-b border-line">
                    <th scope="row" className={`py-2 text-left font-extrabold ${judgementStyle[key]}`}>
                      {text.judgement[key]}
                    </th>
                    <td className="py-2 text-muted">{text.scoring.ranges[key]}</td>
                    <td className="py-2 text-right font-bold tabular-nums">{scoreRange[key]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-sm text-muted">{text.scoring.note}</p>
          </section>

          <section aria-labelledby="faq-title" className={card}>
            <h2 id="faq-title" className={cardTitle}>
              {text.faq.title}
            </h2>
            <div className="mt-1">
              {text.faq.items.map((item, index) => (
                <details key={item.question} open={index === 0} className="border-b border-line py-2.5">
                  <summary className="flex min-h-11 cursor-pointer items-center font-extrabold">
                    {item.question}
                  </summary>
                  <p className="pb-1 text-sm text-muted">{item.answer}</p>
                </details>
              ))}
            </div>
            <h3 className="mt-4 text-sm font-extrabold text-ink">{text.faq.changelog}</h3>
            <ul className="mt-1 text-sm text-muted">
              {text.faq.changelogItems.map((entry) => (
                <li key={entry.date} className="flex flex-wrap gap-x-3">
                  <time dateTime={entry.date} className="font-bold tabular-nums">
                    {entry.date}
                  </time>
                  {entry.note}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </Container>
    </Experience>
  );
}
