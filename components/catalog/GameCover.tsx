import Image from "next/image";
import type { GameManifest } from "@/lib/catalog/schema";

/**
 * 遊戲封面。目前是原創的幾何 SVG，放在有版本的路徑下；
 * 標題一定會出現在旁邊，所以封面當作裝飾圖（alt 留空）。
 */
export function GameCover({
  game,
  size = 112,
  priority = false,
  className = "",
}: {
  game: Pick<GameManifest, "cover">;
  size?: number;
  priority?: boolean;
  className?: string;
}) {
  return (
    <Image
      src={game.cover}
      alt=""
      width={size}
      height={size}
      unoptimized
      priority={priority}
      className={`object-cover ${className}`}
    />
  );
}
