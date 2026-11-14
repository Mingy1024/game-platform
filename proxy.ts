import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getActiveCategories, getPublishedGames } from "@/lib/catalog/catalog";

/**
 * 不存在的遊戲／分類網址要回傳真正的 404。
 *
 * 開啟 Cache Components 後，動態路由會先串流頁面外殼（狀態碼已是 200），
 * 之後頁面裡的 notFound() 改不了狀態碼。所以在渲染前先比對目錄，
 * 找不到就改寫到一個不存在的路徑，讓 Next.js 以 404 回應並顯示 app/not-found.tsx。
 */
const gameSlugs = new Set(getPublishedGames().map((game) => game.slug));
const categorySlugs = new Set(getActiveCategories().map((category) => category.slug));

export function proxy(request: NextRequest) {
  const [section, slug, ...rest] = request.nextUrl.pathname.split("/").filter(Boolean);
  if (!slug || rest.length > 0) return NextResponse.next();

  const known = section === "games" ? gameSlugs : categorySlugs;
  if (known.has(decodeURIComponent(slug))) return NextResponse.next();

  return NextResponse.rewrite(new URL("/__not-found__", request.url));
}

export const config = {
  matcher: ["/games/:slug", "/categories/:slug"],
};
