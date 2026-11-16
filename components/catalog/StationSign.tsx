import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Icon } from "@/components/ui/Icon";
import type { GameManifest } from "@/lib/catalog/schema";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { localePath, type Locale } from "@/lib/i18n/locales";

/**
 * 站名牌：首頁的主推遊戲。
 * 上半是站名（遊戲名稱）與開始按鈕，下半的藍色色帶標出上一站與下一站（另外兩款遊戲）。
 */
export function StationSign({
  game,
  previous,
  next,
  locale,
  dict,
}: {
  game: GameManifest;
  previous?: GameManifest;
  next?: GameManifest;
  locale: Locale;
  dict: Dictionary;
}) {
  return (
    <section
      aria-labelledby="featured-title"
      className="overflow-hidden rounded-sign border-4 border-sign bg-card"
    >
      <div className="md:grid md:grid-cols-[2fr_3fr]">
        {/* 預覽圖：手機在上方、電腦在左側。旁邊就有標題與開始鈕，所以圖片連結不進鍵盤順序、alt 留空 */}
        <Link
          href={localePath(locale, `/games/${game.slug}`)}
          tabIndex={-1}
          aria-hidden="true"
          className="relative block aspect-[4/3] overflow-hidden border-b-4 border-sign md:aspect-auto md:min-h-80 md:border-b-0 md:border-r-4"
        >
          <Image
            src={game.hero}
            alt=""
            fill
            priority
            unoptimized
            sizes="(min-width: 768px) 40vw, 100vw"
            className="object-cover object-[50%_58%] transition-transform duration-500 hover:scale-105 motion-reduce:transition-none motion-reduce:hover:scale-100"
          />
        </Link>
        <div className="flex flex-col items-center justify-center px-5 pb-8 pt-8 text-center sm:pb-10 sm:pt-12">
          <p className="font-semibold text-muted">{dict.home.featured}</p>
          <h2
            id="featured-title"
            className={`mt-1 text-3xl font-black text-ink sm:text-4xl ${
              // 漢字站名拉開字距，其他文字維持正常字距
              /^[\u3400-\u9fff]+$/.test(game.title) ? "pl-[0.25em] tracking-[0.25em]" : ""
            }`}
          >
            {game.title}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-lg text-muted">{game.summary}</p>
          <ButtonLink href={localePath(locale, `/games/${game.slug}`)} size="lg" className="mt-6">
            {dict.actions.play}
          </ButtonLink>
        </div>
      </div>

      <div className="on-dark flex items-stretch bg-sign text-white">
        <SignNeighbour game={previous} direction="previous" locale={locale} dict={dict} />
        <div aria-hidden="true" className="flex min-w-10 flex-1 items-center">
          <span className="h-1 flex-1 bg-white/70" />
          <span className="size-4 shrink-0 rounded-full bg-edge ring-4 ring-white" />
          <span className="h-1 flex-1 bg-white/70" />
        </div>
        <SignNeighbour game={next} direction="next" locale={locale} dict={dict} />
      </div>
    </section>
  );
}

function SignNeighbour({
  game,
  direction,
  locale,
  dict,
}: {
  game?: GameManifest;
  direction: "previous" | "next";
  locale: Locale;
  dict: Dictionary;
}) {
  const isNext = direction === "next";
  if (!game) return <div className="w-28 sm:w-44" />;

  return (
    <Link
      href={localePath(locale, `/games/${game.slug}`)}
      className={`flex min-h-16 items-center gap-1 px-3 py-2 hover:bg-sign-deep sm:gap-2 sm:px-5 ${
        isNext ? "flex-row-reverse text-right" : ""
      }`}
    >
      <Icon name={isNext ? "right" : "left"} />
      <span className="flex flex-col leading-tight">
        <span className="text-sm text-white/85">{isNext ? dict.home.next : dict.home.previous}</span>
        <span className="font-bold sm:text-lg">{game.title}</span>
      </span>
    </Link>
  );
}
