import type { GameManifest } from "@/lib/catalog/schema";

/** 最佳紀錄與本局結果的位置。本機紀錄功能接上前顯示空狀態。 */
export function BestRecord({ game }: { game: GameManifest }) {
  return (
    <section
      aria-labelledby="best-record-title"
      className="rounded-2xl border border-line bg-card p-5"
    >
      <h2 id="best-record-title" className="text-lg font-extrabold text-ink">
        最佳紀錄
      </h2>
      <p className="mt-2 text-2xl font-black tabular-nums text-muted">
        <span aria-hidden="true">—</span>
        <span className="sr-only">還沒有紀錄</span>
        <span className="ml-1 text-base font-semibold">{game.scoreUnit}</span>
      </p>
      <p className="mt-2 text-sm text-muted">
        完成一局後會顯示在這裡，
        {game.scoreOrder === "desc" ? "分數越高越好" : "時間越短越好"}
        。紀錄只存在這台裝置。
      </p>
    </section>
  );
}
