import { GameCover } from "@/components/catalog/GameCover";
import { Icon } from "@/components/ui/Icon";
import type { GameManifest } from "@/lib/catalog/schema";
import { t } from "@/lib/i18n/zh-TW";

/**
 * GameShell 的預留位置。
 *
 * 之後的 GameShell（狀態機：idle → loading → ready → playing ↔ paused → finished）
 * 會取代這個元件，並把遊戲掛在 [data-game-mount] 這個容器裡。
 * 這裡先依 manifest 的 aspectRatio 把空間留好，避免之後版面位移。
 */
export function GameShellPlaceholder({ game }: { game: GameManifest }) {
  const noteId = `game-note-${game.slug}`;

  return (
    <section aria-label={`${game.title} 遊戲畫面`}>
      <div
        data-game-mount={game.slug}
        className="on-dark relative mx-auto flex w-full flex-col items-center justify-center overflow-hidden rounded-2xl bg-canvas px-5 text-center text-white"
        style={{
          aspectRatio: game.aspectRatio,
          maxWidth: `calc(72dvh * ${game.aspectRatio})`,
        }}
      >
        <GameCover game={game} size={96} priority className="size-24 rounded-2xl" />
        <p className="mt-4 text-xl font-extrabold">{t.game.comingSoon}</p>
        <p id={noteId} className="mt-1 max-w-xs text-white/80">
          {t.game.placeholderNote}
        </p>
        <button
          type="button"
          disabled
          aria-describedby={noteId}
          className="mt-5 min-h-14 cursor-not-allowed rounded-full bg-white/15 px-8 text-lg font-bold text-white/70"
        >
          {t.actions.play}
        </button>
      </div>

      <div
        role="group"
        aria-label={t.game.controlsLabel}
        className="mx-auto mt-3 flex flex-wrap justify-center gap-2"
      >
        <ControlButton icon="volume" label={t.game.mute} />
        <ControlButton icon="pause" label={t.game.pause} />
        <ControlButton icon="restart" label={t.game.restart} />
        <ControlButton icon="expand" label={t.game.enlarge} />
      </div>
    </section>
  );
}

/** 控制列按鈕：圖示加文字，不只靠圖示傳達。遊戲接上前先停用。 */
function ControlButton({
  icon,
  label,
}: {
  icon: "volume" | "pause" | "restart" | "expand";
  label: string;
}) {
  return (
    <button
      type="button"
      disabled
      className="flex min-h-11 cursor-not-allowed items-center gap-1.5 rounded-full bg-card px-4 font-semibold text-muted ring-1 ring-inset ring-line disabled:opacity-60"
    >
      <Icon name={icon} />
      {label}
    </button>
  );
}
