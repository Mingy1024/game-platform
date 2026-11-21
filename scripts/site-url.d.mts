/** scripts/site-url.mjs 的型別（給 TypeScript 的測試使用） */
export function checkSiteUrl(raw: string | undefined): { origin: string } | { error: string };
