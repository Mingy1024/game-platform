import Image from "next/image";
import type { GameManifest } from "@/lib/catalog/schema";

/**
 * 遊戲封面，放在有版本的路徑下。圖片填滿外框（外框決定大小），
 * 標題一定會出現在旁邊，所以封面當作裝飾圖（alt 留空）。
 * 封面很小、通常就在第一屏，所以不延遲載入。
 */
export function GameCover({
  game,
  className = "",
}: {
  game: Pick<GameManifest, "cover">;
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image src={game.cover} alt="" fill sizes="112px" unoptimized loading="eager" className="object-cover" />
    </div>
  );
}
