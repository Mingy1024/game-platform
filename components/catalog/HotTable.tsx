import Link from "next/link";
import { getCategoriesOfGame } from "@/lib/catalog/catalog";
import type { GameManifest } from "@/lib/catalog/schema";

export type HotEntry = { game: GameManifest; plays: number };

/**
 * 熱門榜（時刻表樣式）。
 * entries 為 null 代表統計尚未啟用：只顯示表頭與說明，不放假數字。
 */
export function HotTable({
  entries,
  caption,
}: {
  entries: HotEntry[] | null;
  caption: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      <table className="w-full text-left">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-sign text-white">
          <tr>
            <th scope="col" className="w-20 px-4 py-3 font-bold">
              名次
            </th>
            <th scope="col" className="px-4 py-3 font-bold">
              遊戲
            </th>
            <th scope="col" className="hidden px-4 py-3 font-bold sm:table-cell">
              分類
            </th>
            <th scope="col" className="px-4 py-3 text-right font-bold">
              遊玩次數
            </th>
          </tr>
        </thead>
        <tbody>
          {entries === null || entries.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-10 text-center">
                <p className="text-lg font-bold text-ink">
                  {entries === null ? "遊玩統計還沒啟用" : "這段期間還沒有遊玩紀錄"}
                </p>
                <p className="mx-auto mt-1 max-w-md text-muted">
                  {entries === null
                    ? "統計上線後，這裡會依遊玩次數排出名次。現在可以先到全部遊戲逛逛。"
                    : "有人開始玩之後，名次就會出現在這裡。"}
                </p>
              </td>
            </tr>
          ) : (
            entries.map((entry, index) => (
              <tr key={entry.game.id} className="border-t border-line">
                <td className="px-4 py-3 text-xl font-black tabular-nums text-sign">
                  {index + 1}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/games/${entry.game.slug}`}
                    className="font-bold text-ink underline-offset-4 hover:underline"
                  >
                    {entry.game.title}
                  </Link>
                </td>
                <td className="hidden px-4 py-3 text-muted sm:table-cell">
                  {getCategoriesOfGame(entry.game)
                    .map((category) => category.name)
                    .join("、")}
                </td>
                <td className="px-4 py-3 text-right font-bold tabular-nums">
                  {entry.plays.toLocaleString("zh-TW")}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
