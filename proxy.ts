import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getActiveCategories, getPublishedGames } from "@/lib/catalog/catalog";
import { LOCALE_COOKIE, isLocale, localeFromPrefix, localeInfo } from "@/lib/i18n/locales";

/**
 * 不存在的網址要回傳真正的 404。
 *
 * 開啟 Cache Components 後，動態路由會先串流頁面外殼（狀態碼已是 200），
 * 之後頁面裡的 notFound() 改不了狀態碼。所以在渲染前先比對目錄和語言，
 * 對不上就改寫到一個不存在的路徑，讓 Next.js 以 404 回應（app/global-not-found.tsx）。
 */
const gameSlugs = new Set(getPublishedGames().map((game) => game.slug));
const categorySlugs = new Set(getActiveCategories().map((category) => category.slug));

/** 只有繁體中文的頁面 */
const zhOnlySections = new Set(["categories", "hot", "me", "about", "contact", "privacy", "terms"]);

const CODE = /^[A-Za-z0-9_-]{1,64}$/;

function notFound(request: NextRequest) {
  // 兩段的路徑不會對到任何路由（[locale] 底下沒有 404 這一頁）
  return NextResponse.rewrite(new URL("/__not-found__/404", request.url));
}

/** 檢查不含語言前綴的路徑。translatedOnly：其他語言只開放有翻譯的頁面。 */
function isKnownPath(segments: string[], translatedOnly: boolean): boolean {
  const [section, slug, ...rest] = segments;
  if (!section) return true;
  if (section === "games") {
    if (!slug) return !translatedOnly;
    if (!gameSlugs.has(slug)) return false;
    if (rest.length === 0) return true;
    // 成績連結：/games/<slug>/r/<代碼>，以及它的成績圖 /card
    if (rest[0] !== "r" || !rest[1] || !CODE.test(rest[1])) return false;
    return rest.length === 2 || (rest.length === 3 && rest[2] === "card");
  }
  if (translatedOnly) return false;
  // 我的紀錄底下的帳號設定
  if (section === "me" && slug === "settings") return rest.length === 0;
  if (section === "categories") return rest.length === 0 && !!slug && categorySlugs.has(slug);
  return zhOnlySections.has(section) && !slug;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let segments: string[];
  try {
    segments = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    return notFound(request);
  }

  // 首頁：沿用使用者上次自己選的語言（不看瀏覽器語言）
  if (segments.length === 0) {
    const chosen = request.cookies.get(LOCALE_COOKIE)?.value;
    if (chosen && isLocale(chosen) && localeInfo[chosen].prefix) {
      return NextResponse.redirect(new URL(`/${localeInfo[chosen].prefix}`, request.url));
    }
    return NextResponse.next();
  }

  const locale = localeFromPrefix(segments[0]);
  const known = locale ? isKnownPath(segments.slice(1), true) : isKnownPath(segments, false);
  return known ? NextResponse.next() : notFound(request);
}

export const config = {
  // 靜態檔案、Next.js 內部路徑、API 不經過這裡
  matcher: ["/((?!_next/|api/|favicon\\.ico|games/[^/]+/[^/]+/[^/]+\\.[a-z0-9]+$|.*\\.(?:svg|png|jpg|webp|ico|txt|xml|mp3|wav)$).*)"],
};
