/**
 * 要先問同意才建立訪客的地區（精準停車設計稿第 37 題，T11）：歐洲經濟區（歐盟 27 國＋冰島、列支敦斯登、挪威）、英國、瑞士。
 * 國家代碼是 Cloudflare 判斷的 ISO 3166-1 alpha-2。
 */
const CONSENT_COUNTRIES: ReadonlySet<string> = new Set([
  // 歐盟
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
  "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  // 歐洲經濟區的其他國家
  "IS", "LI", "NO",
  // 英國、瑞士
  "GB", "CH",
]);

export function consentRequiredFor(country: string | null | undefined): boolean {
  return !!country && CONSENT_COUNTRIES.has(country.toUpperCase());
}
