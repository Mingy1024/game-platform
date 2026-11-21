import { getActiveCategories, getPublishedGames } from "./catalog/catalog";
import { PREFIXED_LOCALES, localeFromPrefix, localeInfo } from "./i18n/locales";

/**
 * 網站有哪些網址。純邏輯，伺服器的 404 判斷（server/middleware/site-routes.ts）
 * 和建置時預先產生的頁面清單（nuxt.config.ts）都用這裡。
 */
export const gameSlugs = () => getPublishedGames().map((game) => game.slug);

/** 只有繁體中文的頁面 */
const zhOnlySections = new Set(["categories", "hot", "me", "about", "contact", "privacy", "terms"]);

/** 成績代碼的字元 */
export const SHARE_CODE = /^[A-Za-z0-9_-]{1,64}$/;

/** 檢查不含語言前綴的路徑。translatedOnly：其他語言只開放有翻譯的頁面。 */
function isKnownPath(segments: string[], translatedOnly: boolean): boolean {
  const [section, slug, ...rest] = segments;
  if (!section) return true;
  if (section === "games") {
    if (!slug) return !translatedOnly;
    if (!gameSlugs().includes(slug)) return false;
    if (rest.length === 0) return true;
    // 成績連結：/games/<slug>/r/<代碼>，以及它的成績圖 /card
    if (rest[0] !== "r" || !rest[1] || !SHARE_CODE.test(rest[1])) return false;
    return rest.length === 2 || (rest.length === 3 && rest[2] === "card");
  }
  if (translatedOnly) return false;
  // 我的紀錄底下的帳號設定
  if (section === "me" && slug === "settings") return rest.length === 0;
  if (section === "categories") {
    return rest.length === 0 && !!slug && getActiveCategories().some((category) => category.slug === slug);
  }
  return zhOnlySections.has(section) && !slug;
}

/** 網址是否對得到網站上的頁面（不含 /api 和靜態檔案）；segments 已經解碼 */
export function isSitePath(segments: string[]): boolean {
  const locale = localeFromPrefix(segments[0]);
  return locale ? isKnownPath(segments.slice(1), true) : isKnownPath(segments, false);
}

/**
 * 建置時預先產生的頁面：內容不隨請求改變的都放進來。
 * 不放：首頁 /（要先看語言 cookie）、成績連結（代碼是任意值）、我的紀錄與帳號設定（不收錄、內容依登入狀態）。
 */
export function prerenderRoutes(): string[] {
  const games = gameSlugs();
  return [
    "/games",
    "/hot",
    "/about",
    "/contact",
    "/privacy",
    "/terms",
    ...getActiveCategories().map((category) => `/categories/${category.slug}`),
    ...games.map((slug) => `/games/${slug}`),
    ...PREFIXED_LOCALES.flatMap((locale) => {
      const prefix = `/${localeInfo[locale].prefix}`;
      return [prefix, ...games.map((slug) => `${prefix}/games/${slug}`)];
    }),
  ];
}
