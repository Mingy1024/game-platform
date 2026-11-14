import Link from "next/link";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Icon } from "@/components/ui/Icon";
import type { GameManifest } from "@/lib/catalog/schema";
import { t } from "@/lib/i18n/zh-TW";

/**
 * 站名牌：首頁的主推遊戲。
 * 上半是站名（遊戲名稱）與開始按鈕，下半的藍色色帶標出上一站與下一站（另外兩款遊戲）。
 */
export function StationSign({
  game,
  previous,
  next,
}: {
  game: GameManifest;
  previous?: GameManifest;
  next?: GameManifest;
}) {
  return (
    <section
      aria-labelledby="featured-title"
      className="overflow-hidden rounded-sign border-4 border-sign bg-card"
    >
      <div className="px-5 pb-8 pt-8 text-center sm:pb-10 sm:pt-12">
        <p className="font-semibold text-muted">本站主推</p>
        <h2
          id="featured-title"
          className="mt-1 pl-[0.25em] text-3xl font-black tracking-[0.25em] text-ink sm:text-4xl"
        >
          {game.title}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-lg text-muted">{game.summary}</p>
        <ButtonLink href={`/games/${game.slug}`} size="lg" className="mt-6">
          {t.actions.play}
        </ButtonLink>
      </div>

      <div className="on-dark flex items-stretch bg-sign text-white">
        <SignNeighbour game={previous} direction="previous" />
        <div aria-hidden="true" className="flex min-w-10 flex-1 items-center">
          <span className="h-1 flex-1 bg-white/70" />
          <span className="size-4 shrink-0 rounded-full bg-edge ring-4 ring-white" />
          <span className="h-1 flex-1 bg-white/70" />
        </div>
        <SignNeighbour game={next} direction="next" />
      </div>
    </section>
  );
}

function SignNeighbour({
  game,
  direction,
}: {
  game?: GameManifest;
  direction: "previous" | "next";
}) {
  const isNext = direction === "next";
  if (!game) return <div className="w-28 sm:w-44" />;

  return (
    <Link
      href={`/games/${game.slug}`}
      className={`flex min-h-16 items-center gap-1 px-3 py-2 hover:bg-sign-deep sm:gap-2 sm:px-5 ${
        isNext ? "flex-row-reverse text-right" : ""
      }`}
    >
      <Icon name={isNext ? "right" : "left"} />
      <span className="flex flex-col leading-tight">
        <span className="text-sm text-white/85">{isNext ? "下一站" : "上一站"}</span>
        <span className="font-bold sm:text-lg">{game.title}</span>
      </span>
    </Link>
  );
}
