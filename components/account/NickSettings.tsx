"use client";

import { useId, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { nickText } from "@/lib/account/nick/nick";
import { checkNickFormat, cleanNick, nickLength, NICK_COOLDOWN_MS, NICK_MAX, type NickError } from "@/lib/account/nick/rules";
import { saveNick, useMe } from "@/lib/account/use-me";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { LoginButton } from "./LoginButton";

/** 日期依台灣時間顯示到「日」，例如「11 月 27 日」 */
function taiwanDay(date: Date): string {
  const parts = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", month: "numeric", day: "numeric" }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("month")} 月 ${value("day")} 日`;
}

const ERROR_TEXT: Record<NickError | "network", (next?: Date) => string> = {
  length: () => "要 2 到 12 個字",
  chars: () => "有不能用的字：只能用中英日韓文字、數字、空格和 · - _ .",
  blocked: () => "這個名字不能用，換一個試試",
  taken: () => "這個名字有人用了",
  too_soon: (next) => (next ? `7 天只能改一次，下次可以改：${taiwanDay(next)}` : "7 天只能改一次"),
  rate: () => "改太快了，等一分鐘再試",
  network: () => "沒有成功，等一下再試一次。",
};

/** 帳號設定頁（只有繁體中文）：只有改暱稱 */
export function NickSettings({ labels }: { labels: Dictionary["account"] }) {
  const me = useMe();

  if (me.status === "loading") return <div aria-hidden="true" className="min-h-[420px]" />;

  if (me.status !== "loggedIn") {
    return (
      <section className="flex flex-col items-start gap-4 rounded-[18px] border border-line bg-card px-4 py-[18px] sm:px-6" data-testid="settings-logged-out">
        <p className="text-lg font-bold">用 Google 登入才能自訂暱稱</p>
        <LoginButton labels={labels} size="lg" />
      </section>
    );
  }

  return (
    <>
      <p className="-mt-2 flex items-center gap-1.5 text-sm font-bold text-signal">
        <Icon name="check" size={16} />
        已用 Google 登入，只存帳號代碼
      </p>
      <NickForm current={me.nick} nextAt={me.nickNextAt} />
    </>
  );
}

function NickForm({
  current,
  nextAt,
}: {
  current: Extract<ReturnType<typeof useMe>, { status: "loggedIn" }>["nick"];
  nextAt: Date | null;
}) {
  const id = useId();
  const [value, setValue] = useState(current.custom ?? "");
  const [serverError, setServerError] = useState<{ error: NickError | "network"; next?: Date } | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [afterSave] = useState(() => taiwanDay(new Date(Date.now() + NICK_COOLDOWN_MS)));

  const cleaned = cleanNick(value);
  // 打字時只檢查長度和字元；重複、禁字等送出後由伺服器判斷
  const liveError = cleaned ? checkNickFormat(cleaned) : null;
  const shownLiveError = liveError === "length" || liveError === "chars" ? liveError : null;
  const error = serverError ?? (shownLiveError ? { error: shownLiveError } : null);
  const coolingDown = nextAt !== null;
  const unchanged = cleaned === (current.custom ?? "");
  const randomName = nickText({ ...current, custom: null }, "zh-TW");

  const submit = async () => {
    if (!cleaned || shownLiveError) return;
    setBusy(true);
    setServerError(null);
    const result = await saveNick(cleaned);
    setBusy(false);
    if (result.ok) setSaved(true);
    else setServerError({ error: result.error, next: result.nickNextAt });
  };

  const reset = async () => {
    setBusy(true);
    setServerError(null);
    const result = await saveNick(null);
    setBusy(false);
    if (result.ok) {
      setValue("");
      setSaved(true);
    }
    else setServerError({ error: result.error });
  };

  return (
    <section className="flex flex-col gap-2.5 rounded-[18px] border border-line bg-card px-4 py-[18px] sm:px-6" data-testid="nick-form">
      <div className="flex items-baseline justify-between">
        <label htmlFor={`${id}-nick`} className="text-lg font-black">
          暱稱
        </label>
        <span className="text-sm tabular-nums text-muted" aria-hidden="true">
          {nickLength(cleaned)}／{NICK_MAX}
        </span>
      </div>
      <p className="-mt-1.5 text-sm text-muted" id={`${id}-help`}>
        榜上和成績圖都用這個名字
      </p>
      <form
        className="flex flex-col gap-2.5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <input
          id={`${id}-nick`}
          type="text"
          value={value}
          placeholder={randomName}
          disabled={coolingDown || busy}
          autoComplete="off"
          enterKeyHint="done"
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-help ${id}-status ${id}-rules`}
          onChange={(event) => {
            setValue(event.target.value);
            setServerError(null);
            setSaved(false);
          }}
          className={`min-h-13 w-full rounded-xl bg-card px-3.5 text-lg font-bold text-ink placeholder:font-normal placeholder:text-muted disabled:bg-platform ${
            error ? "border-2 border-express" : "border border-line"
          }`}
        />
        <div id={`${id}-status`} aria-live="polite">
          {error ? (
            <p className="flex items-center gap-1.5 text-[15px] font-bold text-express-deep" data-testid="nick-error">
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <circle cx="12" cy="12" r="9.5" />
                <path d="M12 7.5v5.5M12 16.5v.2" />
              </svg>
              {ERROR_TEXT[error.error](error.next)}
            </p>
          ) : saved ? (
            <p role="status" className="flex items-center gap-1.5 text-[15px] font-bold text-signal" data-testid="nick-saved">
              <Icon name="check" size={18} />
              改好了
            </p>
          ) : null}
        </div>
        {coolingDown ? (
          <div className="rounded-xl bg-sign-tint px-3 py-2.5 text-[15px]" data-testid="nick-next">
            下次可以改：<strong>{taiwanDay(nextAt)}</strong>
          </div>
        ) : (
          <ul id={`${id}-rules`} className="list-disc pl-5 text-sm leading-relaxed text-muted">
            <li>2 到 12 個字</li>
            <li>7 天可以改一次</li>
            <li>不能放網址或電話</li>
            <li>不雅或冒用的名字，會被改回隨機名字</li>
          </ul>
        )}
        <div className="mt-1 flex gap-2">
          <button
            type="submit"
            disabled={coolingDown || busy || !cleaned || unchanged || shownLiveError !== null}
            className="press min-h-12 flex-1 rounded-full bg-express px-4 font-bold text-white hover:bg-express-deep disabled:bg-line disabled:text-muted"
          >
            儲存
          </button>
          {current.custom ? (
            <button
              type="button"
              disabled={busy}
              onClick={reset}
              className="press min-h-12 flex-1 rounded-full border border-line bg-card px-4 font-bold text-sign disabled:opacity-60"
            >
              改回隨機名字
            </button>
          ) : null}
        </div>
        {!coolingDown ? (
          <p className="text-sm text-muted">儲存之後，下次可以改：{afterSave}</p>
        ) : null}
      </form>
    </section>
  );
}
