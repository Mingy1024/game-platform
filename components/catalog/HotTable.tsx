import Link from "next/link";
import { getCategoriesOfGame } from "@/lib/catalog/catalog";
import type { GameManifest } from "@/lib/catalog/schema";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { localeInfo, localePath, type Locale } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/zh-TW";

/** plays 是 null 代表統計還沒啟用：列出遊戲，但名次和次數顯示「—」，不放假數字 */
export type HotEntry = { game: GameManifest; plays: number | null };

/** 統計還沒接上時用：每款遊戲一列，沒有次數 */
export const withoutStats = (games: GameManifest[]): HotEntry[] =>
  games.map((game) => ({ game, plays: null }));

/** 熱門榜（時刻表樣式） */
export function HotTable({
  entries,
  caption,
  labels = t.home,
  locale = "zh-TW",
  categoryLabels,
}: {
  entries: HotEntry[];
  caption: string;
  /** 其他語言的首頁傳入翻譯後的文字 */
  labels?: Dictionary["home"];
  locale?: Locale;
  /** 分類 slug → 該語言的名稱；不給就用繁體中文 */
  categoryLabels?: Record<string, string>;
}) {
  const live = entries.some((entry) => entry.plays !== null);
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      <table className="w-full text-left">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-sign text-white">
          <tr>
            <th scope="col" className="w-20 px-4 py-3 font-bold">
              {labels.hotRank}
            </th>
            <th scope="col" className="px-4 py-3 font-bold">
              {labels.hotGame}
            </th>
            <th scope="col" className="hidden px-4 py-3 font-bold sm:table-cell">
              {labels.hotCategory}
            </th>
            <th scope="col" className="px-4 py-3 text-right font-bold">
              {labels.hotPlays}
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => (
            <tr key={entry.game.id} className="border-t border-line">
              <td className="px-4 py-3 text-xl font-black tabular-nums text-sign">{live ? index + 1 : "—"}</td>
              <td className="px-4 py-3">
                <Link
                  href={localePath(locale, `/games/${entry.game.slug}`)}
                  className="-my-2 flex min-h-11 items-center font-bold text-ink underline-offset-4 hover:underline"
                >
                  {entry.game.title}
                </Link>
              </td>
              <td className="hidden px-4 py-3 text-muted sm:table-cell">
                {getCategoriesOfGame(entry.game)
                  .map((category) => categoryLabels?.[category.slug] ?? category.name)
                  .join(locale.startsWith("zh") || locale === "ja" ? "、" : ", ")}
              </td>
              <td className="px-4 py-3 text-right font-bold tabular-nums">
                {entry.plays === null ? "—" : entry.plays.toLocaleString(localeInfo[locale].intl)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!live && (
        <p className="border-t border-line px-4 py-3 text-sm text-muted" data-testid="hot-not-live">
          <strong className="text-ink">{labels.hotEmptyTitle}</strong>　{labels.hotEmptyBody}
        </p>
      )}
    </div>
  );
}
