import { nickParts, type Nick } from "@/lib/account/nick/nick";
import type { Locale } from "@/lib/i18n/locales";

/**
 * 依語言顯示暱稱。隨機暱稱的四位數用灰色等寬數字，和名字分開；自訂暱稱沒有四位數。
 * 排行榜、結算卡、帳號卡共用。
 */
export function NickName({
  nick,
  locale,
  className = "",
  numberClassName = "",
}: {
  nick: Nick;
  locale: Locale;
  className?: string;
  numberClassName?: string;
}) {
  const { name, number } = nickParts(nick, locale);
  return (
    <span className={className} data-testid="nick-name">
      <strong className="font-black">{name}</strong>
      {number ? (
        <>
          {" "}
          <span className={`font-bold tabular-nums text-muted ${numberClassName}`}>{number}</span>
        </>
      ) : null}
    </span>
  );
}
