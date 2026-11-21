import type { Locale } from "@/lib/i18n/locales";
import { ADJECTIVES, NOUNS } from "./words";

/** 暱稱：隨機的三個編號，加上可有可無的自訂暱稱 */
export type Nick = {
  adj: number;
  noun: number;
  num: number;
  custom: string | null;
};

/** 顯示用的暱稱：自訂暱稱只有 name；隨機暱稱的四位數另外放，畫面上用灰色等寬數字 */
export type NickParts = { name: string; number: string | null };

/** 名詞在前、形容詞在後的語言 */
const NOUN_FIRST: ReadonlySet<Locale> = new Set(["vi", "pt"]);
/** 形容詞和名詞直接相連、不加空格的語言 */
const NO_SPACE: ReadonlySet<Locale> = new Set(["zh-TW", "zh-CN", "ja"]);

export function randomNickName(nick: Pick<Nick, "adj" | "noun">, locale: Locale): string {
  const adj = ADJECTIVES[nick.adj % ADJECTIVES.length][locale];
  const noun = NOUNS[nick.noun % NOUNS.length][locale];
  const [first, second] = NOUN_FIRST.has(locale) ? [noun, adj] : [adj, noun];
  return NO_SPACE.has(locale) ? `${first}${second}` : `${first} ${second}`;
}

export function nickParts(nick: Nick, locale: Locale): NickParts {
  if (nick.custom) return { name: nick.custom, number: null };
  return { name: randomNickName(nick, locale), number: String(nick.num).padStart(4, "0") };
}

/** 一行文字的暱稱，例如「準點的月台 0427」 */
export function nickText(nick: Nick, locale: Locale): string {
  const parts = nickParts(nick, locale);
  return parts.number ? `${parts.name} ${parts.number}` : parts.name;
}

/** 新玩家的隨機暱稱 */
export function randomNick(random: (max: number) => number): Omit<Nick, "custom"> {
  return {
    adj: random(ADJECTIVES.length),
    noun: random(NOUNS.length),
    num: random(10000),
  };
}
