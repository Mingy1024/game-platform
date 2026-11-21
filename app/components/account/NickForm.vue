<script setup lang="ts">
import { readMe, resyncNick, saveNick, type NickResult } from "@/lib/account/me-store";
import { nickText, type Nick } from "@/lib/account/nick/nick";
import { checkNickFormat, cleanNick, nickLength, NICK_COOLDOWN_MS, NICK_MAX } from "@/lib/account/nick/rules";

/** 日期依台灣時間顯示到「日」，例如「11 月 27 日」 */
function taiwanDay(date: Date): string {
  const parts = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", month: "numeric", day: "numeric" }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("month")} 月 ${value("day")} 日`;
}

type FormError = Extract<NickResult, { ok: false }>["error"];

const ERROR_TEXT: Record<FormError, (next?: Date) => string> = {
  length: () => "要 2 到 12 個字",
  chars: () => "有不能用的字：只能用中英日韓文字、數字、空格和 · - _ .",
  blocked: () => "這個名字不能用，換一個試試",
  taken: () => "這個名字有人用了",
  too_soon: (next) => (next ? `7 天只能改一次，下次可以改：${taiwanDay(next)}` : "7 天只能改一次"),
  conflict: () => "暱稱剛剛在別的地方改過了，已經換成最新的，請再確認一次",
  stale: () => "暱稱剛剛在別的地方改過了，但讀不到最新的暱稱",
  rate: () => "改太快了，等一分鐘再試",
  network: () => "沒有成功，等一下再試一次。",
};

const { current, nextAt } = defineProps<{ current: Nick; nextAt: Date | null }>();

const id = useId();
const value = ref(current.custom ?? "");
const serverError = ref<{ error: FormError; next?: Date } | null>(null);
const saved = ref(false);
const busy = ref(false);
const afterSave = taiwanDay(new Date(Date.now() + NICK_COOLDOWN_MS));

const cleaned = computed(() => cleanNick(value.value));
// 打字時只檢查長度和字元；重複、禁字等送出後由伺服器判斷
const shownLiveError = computed(() => {
  const live = cleaned.value ? checkNickFormat(cleaned.value) : null;
  return live === "length" || live === "chars" ? live : null;
});
const error = computed(() => serverError.value ?? (shownLiveError.value ? { error: shownLiveError.value } : null));
const coolingDown = computed(() => nextAt !== null);
const unchanged = computed(() => cleaned.value === (current.custom ?? ""));
const randomName = computed(() => nickText({ ...current, custom: null }, "zh-TW"));

/**
 * 輸入框換成帳號目前的暱稱（儲存成功、別的地方改過名字後重新讀取完成時）。
 * 直接讀共用的狀態，不等 props 更新；即使暱稱和原本一樣也要換，才會清掉沒存成的草稿。
 */
function syncInput() {
  const latest = readMe();
  if (latest.status === "loggedIn") value.value = latest.nick.custom ?? "";
}

function onInput(event: Event) {
  value.value = (event.target as HTMLInputElement).value;
  serverError.value = null;
  saved.value = false;
}

/**
 * 儲存、改回隨機名字、重新讀取都用這裡顯示結果。
 * 成功或已經重新讀取到最新狀態（synced）時，輸入框換成目前的暱稱；提示的冷卻日期由 saveNick／resyncNick 依最新狀態給。
 */
function show(result: NickResult) {
  if (result.ok || result.synced) syncInput();
  if (result.ok) saved.value = true;
  else serverError.value = { error: result.error, next: result.nickNextAt };
}

/** 送出請求的共用外殼：送出期間停用按鈕、清掉舊提示 */
async function run(action: () => Promise<NickResult>) {
  busy.value = true;
  serverError.value = null;
  saved.value = false;
  const result = await action();
  busy.value = false;
  show(result);
}

function submit() {
  if (!cleaned.value || shownLiveError.value) return;
  const custom = cleaned.value;
  void run(() => saveNick(custom));
}

const reset = () => run(() => saveNick(null));

/** 讀不到最新暱稱時重試 */
function retryRefresh() {
  const next = serverError.value?.next;
  void run(() => resyncNick(next));
}
</script>

<template>
  <section class="flex flex-col gap-2.5 rounded-[18px] border border-line bg-card px-4 py-[18px] sm:px-6" data-testid="nick-form">
    <div class="flex items-baseline justify-between">
      <label :for="`${id}-nick`" class="text-lg font-black">暱稱</label>
      <span class="text-sm tabular-nums text-muted" aria-hidden="true">{{ nickLength(cleaned) }}／{{ NICK_MAX }}</span>
    </div>
    <p :id="`${id}-help`" class="-mt-1.5 text-sm text-muted">榜上和成績圖都用這個名字</p>
    <form class="flex flex-col gap-2.5" @submit.prevent="submit">
      <input
        :id="`${id}-nick`"
        type="text"
        :value="value"
        :placeholder="randomName"
        :disabled="coolingDown || busy"
        autocomplete="off"
        enterkeyhint="done"
        :aria-invalid="error ? true : undefined"
        :aria-describedby="`${id}-help ${id}-status ${id}-rules`"
        :class="`min-h-13 w-full rounded-xl bg-card px-3.5 text-lg font-bold text-ink placeholder:font-normal placeholder:text-muted disabled:bg-platform ${
          error ? 'border-2 border-express' : 'border border-line'
        }`"
        @input="onInput"
      >
      <div :id="`${id}-status`" aria-live="polite">
        <p v-if="error" class="flex items-center gap-1.5 text-[15px] font-bold text-express-deep" data-testid="nick-error">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
            <circle cx="12" cy="12" r="9.5" />
            <path d="M12 7.5v5.5M12 16.5v.2" />
          </svg>
          {{ ERROR_TEXT[error.error](error.next) }}
          <button
            v-if="error.error === 'stale'"
            type="button"
            :disabled="busy"
            class="ml-1 underline disabled:opacity-60"
            data-testid="nick-retry"
            @click="retryRefresh"
          >
            重新讀取
          </button>
        </p>
        <p v-else-if="saved" role="status" class="flex items-center gap-1.5 text-[15px] font-bold text-signal" data-testid="nick-saved">
          <Icon name="check" :size="18" />
          改好了
        </p>
      </div>
      <div v-if="coolingDown && nextAt" class="rounded-xl bg-sign-tint px-3 py-2.5 text-[15px]" data-testid="nick-next">
        下次可以改：<strong>{{ taiwanDay(nextAt) }}</strong>
      </div>
      <ul v-else :id="`${id}-rules`" class="list-disc pl-5 text-sm leading-relaxed text-muted">
        <li>2 到 12 個字</li>
        <li>7 天可以改一次</li>
        <li>不能放網址或電話</li>
        <li>不雅或冒用的名字，會被改回隨機名字</li>
      </ul>
      <div class="mt-1 flex gap-2">
        <button
          type="submit"
          :disabled="coolingDown || busy || !cleaned || unchanged || shownLiveError !== null"
          class="press min-h-12 flex-1 rounded-full bg-express px-4 font-bold text-white hover:bg-express-deep disabled:bg-line disabled:text-muted"
        >
          儲存
        </button>
        <button
          v-if="current.custom"
          type="button"
          :disabled="busy"
          class="press min-h-12 flex-1 rounded-full border border-line bg-card px-4 font-bold text-sign disabled:opacity-60"
          @click="reset"
        >
          改回隨機名字
        </button>
      </div>
      <p v-if="!coolingDown" class="text-sm text-muted">儲存之後，下次可以改：{{ afterSave }}</p>
    </form>
  </section>
</template>
