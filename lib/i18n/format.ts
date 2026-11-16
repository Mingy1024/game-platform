import { localeInfo, type Locale } from "./locales";

/** 把 {name} 這種佔位符換成實際的值 */
export function fmt(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

export function formatNumber(value: number, locale: Locale): string {
  return Math.round(value).toLocaleString(localeInfo[locale].intl);
}

/** 一位小數（秒、公尺） */
export function formatDecimal(value: number, locale: Locale, digits = 1): string {
  return value.toLocaleString(localeInfo[locale].intl, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

const dateOf = (dateKey: string) => new Date(`${dateKey}T00:00:00Z`);

/** 11/15 這種短日期 */
export function formatShortDate(dateKey: string, locale: Locale): string {
  return new Intl.DateTimeFormat(localeInfo[locale].intl, {
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  }).format(dateOf(dateKey));
}

/** 2026/11/15（日）這種完整日期 */
export function formatFullDate(dateKey: string, locale: Locale): string {
  return new Intl.DateTimeFormat(localeInfo[locale].intl, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC",
  }).format(dateOf(dateKey));
}

/** 誤差的顯示：1 m 以下用公分，以上用公尺 */
export function formatError(errorM: number, locale: Locale): string {
  const abs = Math.abs(errorM);
  if (abs < 1) return `${Math.round(abs * 100)} cm`;
  return `${formatDecimal(abs, locale)} m`;
}
