/** 支援的語言。繁體中文是預設語言，網址不加前綴。 */
export const LOCALES = ["zh-TW", "zh-CN", "en", "ja", "ko", "vi", "pt"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "zh-TW";

type LocaleInfo = {
  /** 網址前綴（不含斜線）；預設語言是空字串 */
  prefix: string;
  /** <html lang> 的值 */
  htmlLang: string;
  /** 語言選單顯示的名稱：一律用該語言自己的寫法 */
  nativeName: string;
  /** 手機頁首顯示的短名稱 */
  shortName: string;
  /** 數字、日期格式用的 BCP 47 標籤 */
  intl: string;
};

export const localeInfo: Record<Locale, LocaleInfo> = {
  "zh-TW": { prefix: "", htmlLang: "zh-Hant-TW", nativeName: "繁體中文", shortName: "繁中", intl: "zh-TW" },
  "zh-CN": { prefix: "zh-cn", htmlLang: "zh-Hans-CN", nativeName: "简体中文", shortName: "简中", intl: "zh-CN" },
  en: { prefix: "en", htmlLang: "en", nativeName: "English", shortName: "EN", intl: "en-US" },
  ja: { prefix: "ja", htmlLang: "ja", nativeName: "日本語", shortName: "日本語", intl: "ja-JP" },
  ko: { prefix: "ko", htmlLang: "ko", nativeName: "한국어", shortName: "한국어", intl: "ko-KR" },
  vi: { prefix: "vi", htmlLang: "vi", nativeName: "Tiếng Việt", shortName: "VI", intl: "vi-VN" },
  pt: { prefix: "pt", htmlLang: "pt-BR", nativeName: "Português", shortName: "PT", intl: "pt-BR" },
};

/** 有網址前綴的語言（預設語言以外） */
export const PREFIXED_LOCALES = LOCALES.filter((locale) => localeInfo[locale].prefix !== "");

const byPrefix = new Map<string, Locale>(
  PREFIXED_LOCALES.map((locale) => [localeInfo[locale].prefix, locale]),
);

/** 網址第一段 → 語言；不是語言前綴時回傳 undefined */
export function localeFromPrefix(segment: string | undefined): Locale | undefined {
  return segment ? byPrefix.get(segment) : undefined;
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** 站內路徑加上語言前綴。path 以 / 開頭。 */
export function localePath(locale: Locale, path: string): string {
  const { prefix } = localeInfo[locale];
  if (!prefix) return path;
  return path === "/" ? `/${prefix}` : `/${prefix}${path}`;
}

/** 把目前的路徑拆成語言和不含前綴的路徑 */
export function splitLocalePath(pathname: string): { locale: Locale; path: string } {
  const [, first, ...rest] = pathname.split("/");
  const locale = localeFromPrefix(first);
  if (!locale) return { locale: DEFAULT_LOCALE, path: pathname || "/" };
  return { locale, path: rest.length ? `/${rest.join("/")}` : "/" };
}

/**
 * 有翻譯的頁面：首頁、遊戲介紹頁（含成績連結）。
 * 其他頁面目前只有繁體中文，切換語言時回到該語言的首頁。
 */
export function isTranslatedPath(path: string): boolean {
  return path === "/" || /^\/games\/[a-z0-9-]+(\/r\/[A-Za-z0-9_-]+)?$/.test(path);
}

/** 語言選單要連到哪裡：有翻譯就留在同一頁，否則回首頁 */
export function switchLocalePath(pathname: string, target: Locale): string {
  const { path } = splitLocalePath(pathname);
  return localePath(target, isTranslatedPath(path) ? path : "/");
}

/** 記住使用者選過的語言 */
export const LOCALE_COOKIE = "gs-locale";

/**
 * 首頁（/）要不要轉到使用者上次自己選的語言首頁：cookie 是有前綴的語言時回傳該語言的首頁，否則 null。
 * 不看瀏覽器語言。伺服器（server/middleware/site-routes.ts）和站內換頁（app/middleware/locale-home.global.ts）共用。
 */
export function rememberedHomePath(cookieValue: string | null | undefined): string | null {
  if (!cookieValue || !isLocale(cookieValue)) return null;
  const { prefix } = localeInfo[cookieValue];
  return prefix ? `/${prefix}` : null;
}
