import { getDictionary } from "@/lib/i18n/dictionaries";
import { localeFromPrefix, type Locale } from "@/lib/i18n/locales";

/** 目前頁面的語言：網址第一段是語言前綴（/en、/ja……），沒有前綴是繁體中文 */
export function useLocale() {
  const route = useRoute();
  return computed<Locale>(() => {
    const prefix = typeof route.params.locale === "string" ? route.params.locale : undefined;
    return localeFromPrefix(prefix) ?? "zh-TW";
  });
}

export function useDictionary() {
  const locale = useLocale();
  return computed(() => getDictionary(locale.value));
}
