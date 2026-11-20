/**
 * 自訂暱稱的規則（設計稿第 5 節）。前端打字時和伺服器端都用這一份，
 * 但「重複」「冷卻」「次數」只有伺服器端能判斷。
 */

export const NICK_MIN = 2;
export const NICK_MAX = 12;
/** 自訂暱稱的冷卻時間；改回隨機名字不受限制 */
export const NICK_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export type NickError = "length" | "chars" | "blocked" | "taken" | "too_soon" | "rate";

/** 前端也能判斷的錯誤 */
export type NickFormatError = Extract<NickError, "length" | "chars" | "blocked">;

const segmenter = new Intl.Segmenter("und", { granularity: "grapheme" });

/** 使用者看到的字數（emoji 組合、帶聲調的字母都算一個字） */
export function nickLength(value: string): number {
  return Array.from(segmenter.segment(value)).length;
}

/** 整理輸入：全形半形統一（NFKC）、去掉頭尾空白、連續空白變一個 */
export function cleanNick(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

/** 擋重複用的比對值：再轉小寫、去掉所有空白 */
export function nickKey(value: string): string {
  return cleanNick(value).toLowerCase().replace(/\s/gu, "");
}

/** 中英日韓文字 */
const LETTER = /[\p{Script=Han}\p{Script=Latin}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
/** 允許的字：文字、數字、空格、· - _ .，以及日文的長音「ー」和中黑點「・」 */
const ALLOWED =
  /^[\p{Script=Han}\p{Script=Latin}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Nd}\p{M} ·・ー\-_.]+$/u;

/** 冒充隨機暱稱：結尾是「空格＋四位數」 */
const LOOKS_RANDOM = / \d{4}$/u;
const URL_LIKE = /https?|www|[a-z0-9]\.[a-z]{2,}/iu;

/**
 * 明顯不雅或冒用身分的詞。比對時先轉小寫、去掉空白和符號，所以「管 理 員」「a.d.m.i.n」也會擋。
 * 漏網的由管理者在 D1 把 nick_custom 清空（設計稿第 5 節）。
 */
const BLOCKED_WORDS = [
  // 冒用
  "admin", "administrator", "moderator", "official", "staff", "support",
  "管理員", "管理员", "官方", "客服", "站方", "版主", "運營", "运营", "管理者", "運営", "관리자", "운영자",
  // 不雅（中）
  "幹你", "干你", "操你", "肏", "靠北", "靠杯", "機掰", "雞掰", "鸡巴", "雞巴", "屌你", "王八蛋", "賤人", "贱人",
  "婊子", "妓女", "傻逼", "傻屄", "煞筆", "智障", "白痴", "去死", "淫", "強姦", "强奸", "毒品",
  // 不雅（英）
  "fuck", "shit", "bitch", "cunt", "dick", "pussy", "nigger", "nigga", "faggot", "whore", "slut", "rape", "porn",
  "hitler", "nazi",
  // 不雅（日韓）
  "死ね", "ちんこ", "まんこ", "씨발", "시발", "병신", "좆",
];

function compact(value: string): string {
  return value.toLowerCase().replace(/[\s·・ー\-_.]/gu, "");
}

/** 檢查格式；通過回傳 null。value 要先經過 cleanNick。 */
export function checkNickFormat(value: string): NickFormatError | null {
  const length = nickLength(value);
  if (length < NICK_MIN || length > NICK_MAX) return "length";
  if (!ALLOWED.test(value) || !LETTER.test(value)) return "chars";
  if (LOOKS_RANDOM.test(value)) return "blocked";
  const digitsOnly = value.replace(/[\s\-_.·・]/gu, "");
  if (URL_LIKE.test(value) || /\d{7,}/u.test(digitsOnly)) return "blocked";
  const flat = compact(value);
  if (BLOCKED_WORDS.some((word) => flat.includes(word))) return "blocked";
  return null;
}

/** 下次可以自訂暱稱的時間；null 表示現在就可以 */
export function nickNextAt(changedAt: Date | null, now: Date): Date | null {
  if (!changedAt) return null;
  const next = new Date(changedAt.getTime() + NICK_COOLDOWN_MS);
  return next > now ? next : null;
}
