import type { Metadata } from "next";
import { GamePage, gameMetadata, gameSlugs } from "@/lib/games/precise-stop/game-page";

export function generateStaticParams() {
  return gameSlugs().map((slug) => ({ slug }));
}

// 目錄目前只有精準停車一款，頁面資訊可以直接寫成靜態的
export const metadata: Metadata = gameMetadata("zh-TW", "precise-stop");

/**
 * 目前目錄只有一款遊戲，頁面內容不需要讀網址參數，可以整頁預先產生。
 * 不存在的遊戲網址由 proxy.ts 回 404。
 */
export default function Page() {
  return <GamePage locale="zh-TW" />;
}
