import type { Locale } from "../locales";
import { en } from "./en";
import { ja } from "./ja";
import { ko } from "./ko";
import { pt } from "./pt";
import { vi } from "./vi";
import { zhCN } from "./zh-CN";
import { zhTW } from "./zh-TW";

type Widen<T> = T extends string
  ? string
  : T extends readonly (infer Item)[]
    ? readonly Widen<Item>[]
    : { readonly [Key in keyof T]: Widen<T[Key]> };

/** 所有語言的文字表都要符合這個形狀（以繁體中文為準） */
export type Dictionary = Widen<typeof zhTW>;

export const dictionaries: Record<Locale, Dictionary> = {
  "zh-TW": zhTW,
  "zh-CN": zhCN,
  en,
  ja,
  ko,
  vi,
  pt,
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
