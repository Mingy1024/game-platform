<script setup lang="ts">
import { readConsent, subscribeConsent, writeConsent } from "@/lib/account/leaderboard-consent";
import { deleteGuest } from "@/lib/account/me-store";

/**
 * 我的紀錄頁最下面的「訪客」區塊（精準停車設計稿第 35 張，T11、T15）。
 * - 有訪客：刪除訪客紀錄。確認視窗焦點先在「取消」；成功後伺服器的訪客和紀錄、cookie、這台裝置的紀錄都清掉，
 *   其他分頁收到登出記號；失敗時顯示「沒有成功，等一下再試一次」，本機不清
 * - 歐盟地區另外有「上全站排行」開關：關掉等於刪除訪客紀錄（還沒有訪客時只記下選擇）
 * 完成通知用函式 props（刪除後這個元件可能先被卸載，emit 會被忽略）。
 */
const { nick, consentRequired, onDeleted } = defineProps<{ nick: string | null; consentRequired: boolean; onDeleted: () => void }>();

const consent = useExternalStore(subscribeConsent, readConsent, null);
const confirming = ref(false);
const busy = ref(false);
const failed = ref(false);
const cancelButton = useTemplateRef<HTMLButtonElement>("cancel");
/** 開關是「開」：選了上榜，或還沒決定但已經有訪客 */
const on = computed(() => consent.value === "yes" || (consent.value === null && nick !== null));

watch(confirming, async (value) => {
  if (!value) return;
  await nextTick();
  cancelButton.value?.focus();
});

async function remove(): Promise<boolean> {
  busy.value = true;
  failed.value = false;
  const ok = await deleteGuest();
  busy.value = false;
  if (!ok) failed.value = true;
  return ok;
}

async function confirmDelete() {
  if (!(await remove())) return;
  confirming.value = false;
  if (consentRequired) writeConsent("no");
  onDeleted();
}

async function toggle() {
  if (on.value) {
    // 關掉：有訪客就刪掉，成功才記下「不要」
    if (nick !== null && !(await remove())) return;
    writeConsent("no");
    if (nick !== null) onDeleted();
  } else {
    writeConsent("yes");
  }
}

const plain = "press inline-flex min-h-12 items-center rounded-full border border-line bg-card px-[22px] font-bold disabled:opacity-60";
</script>

<template>
  <section aria-labelledby="guest-actions" class="mt-10 flex flex-col gap-3 border-t border-line pt-6" data-testid="guest-actions">
    <h2 id="guest-actions" class="text-xl font-extrabold">訪客</h2>

    <p v-if="consentRequired" class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px]">
      <span id="consent-label" class="font-bold">上全站排行</span>
      <button
        type="button"
        role="switch"
        :aria-checked="on"
        aria-labelledby="consent-label"
        :disabled="busy"
        data-testid="consent-switch"
        :class="`press min-h-11 min-w-16 rounded-full px-4 font-bold disabled:opacity-60 ${on ? 'bg-sign text-white' : 'border border-line bg-card text-muted'}`"
        @click="toggle"
      >
        {{ on ? "開" : "關" }}
      </button>
      <span class="text-muted">{{ nick !== null ? "關掉等於刪除訪客紀錄" : "打開後，下一局的成績會用訪客暱稱上榜" }}</span>
    </p>

    <template v-if="nick !== null">
      <div
        v-if="confirming"
        role="alertdialog"
        aria-labelledby="guest-delete-title"
        aria-describedby="guest-delete-text"
        class="flex max-w-xl flex-col gap-3 rounded-[18px] border-2 border-express bg-card px-4 py-[18px]"
      >
        <h3 id="guest-delete-title" class="text-[22px] font-black text-express-deep">刪除訪客紀錄？</h3>
        <p id="guest-delete-text" class="leading-relaxed">
          「<strong>{{ nick }}</strong>」會從排行榜移除，紀錄全部刪掉，<strong>無法復原</strong>。
        </p>
        <div class="mt-1 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            :disabled="busy"
            data-testid="guest-delete-confirm"
            class="press min-h-13 flex-1 rounded-full bg-express-deep px-6 text-[17px] font-bold text-white disabled:opacity-60"
            @click="confirmDelete"
          >
            確定刪除
          </button>
          <button
            ref="cancel"
            type="button"
            :disabled="busy"
            class="press min-h-13 flex-1 rounded-full border border-line bg-card px-6 text-[17px] font-bold disabled:opacity-60"
            @click="
              confirming = false;
              failed = false;
            "
          >
            取消
          </button>
        </div>
      </div>
      <div v-else class="flex flex-wrap gap-3">
        <button type="button" :disabled="busy" data-testid="guest-delete" :class="`${plain} text-express-deep`" @click="confirming = true">
          刪除訪客紀錄
        </button>
      </div>
      <p v-if="!confirming" class="text-[15px] text-muted">會從排行榜移除，這台裝置上的紀錄也會清掉，無法復原。之後再玩會是新的訪客。</p>
    </template>

    <div v-if="failed" role="alert" class="max-w-xl rounded-[14px] border-[1.5px] border-express bg-edge-tint px-3.5 py-3">
      沒有成功，等一下再試一次。
    </div>
  </section>
</template>
