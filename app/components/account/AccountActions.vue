<script setup lang="ts">
import { deleteAccount, logout } from "@/lib/account/me-store";
import { hasUnsyncedRecords as escapeUnsynced, syncNow as syncEscape } from "@/lib/games/office-escape/account-sync";
import { hasUnsyncedRecords as preciseUnsynced, syncNow as syncPrecise } from "@/lib/games/precise-stop/account-sync";

/** 各款遊戲有沒有還沒存到帳號的紀錄；登出前兩款都要先試著送出 */
const hasUnsyncedRecords = () => preciseUnsynced() || escapeUnsynced();
const syncNow = () => Promise.all([syncPrecise(), syncEscape()]);

/**
 * 我的紀錄頁最下面的登出與刪除帳號。
 * 完成通知用函式 props 而不是 emit：登出後登入狀態立刻變成「未登入」，這個元件會先被卸載，
 * 卸載後的 emit 會被 Vue 忽略。
 *
 * 登出前還有成績沒存到帳號時，先試送一次；送不出去才顯示提醒（帳號設計稿「登出提醒」畫板，P11）。
 */
const { onLoggedOut, onDeleted } = defineProps<{ nick: string; onLoggedOut: () => void; onDeleted: () => void }>();

const confirming = ref(false);
const busy = ref(false);
const failed = ref(false);
const pendingWarning = ref(false);
const cancelButton = useTemplateRef<HTMLButtonElement>("cancel");
const stayButton = useTemplateRef<HTMLButtonElement>("stay");

// 焦點移到「取消」，避免按 Enter 就刪掉
watch(confirming, async (value) => {
  if (!value) return;
  await nextTick();
  cancelButton.value?.focus();
});
// 登出提醒：焦點移到「先不要登出」
watch(pendingWarning, async (value) => {
  if (!value) return;
  await nextTick();
  stayButton.value?.focus();
});

async function run(action: () => Promise<boolean>, done: () => void) {
  busy.value = true;
  failed.value = false;
  const ok = await action();
  busy.value = false;
  if (ok) done();
  else failed.value = true;
}

async function startLogout() {
  failed.value = false;
  if (hasUnsyncedRecords()) {
    busy.value = true;
    await syncNow();
    busy.value = false;
    // 不看回傳值：最後一輪送完之後，別的分頁可能又多了紀錄
    if (hasUnsyncedRecords()) {
      pendingWarning.value = true;
      return;
    }
  }
  await run(logout, onLoggedOut);
}

const plain =
  "press inline-flex min-h-12 items-center rounded-full border border-line bg-card px-[22px] font-bold disabled:opacity-60";
</script>

<template>
  <section aria-labelledby="account-actions" class="mt-10 flex flex-col gap-3 border-t border-line pt-6">
    <h2 id="account-actions" class="text-xl font-extrabold">帳號</h2>
    <div
      v-if="confirming"
      role="alertdialog"
      aria-labelledby="delete-title"
      aria-describedby="delete-text"
      class="flex max-w-xl flex-col gap-3 rounded-[18px] border-2 border-express bg-card px-4 py-[18px]"
    >
      <h3 id="delete-title" class="text-[22px] font-black text-express-deep">刪除帳號？</h3>
      <p id="delete-text" class="leading-relaxed">
        會刪除你的帳號、暱稱「<strong>{{ nick }}</strong>」和帳號裡的所有紀錄，<strong>無法復原</strong>。
      </p>
      <p class="text-[15px] leading-relaxed text-muted">
        這台裝置上的紀錄也會清掉。之後再用同一個 Google 帳號登入，會是全新的帳號。
      </p>
      <div class="mt-1 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          :disabled="busy"
          class="press min-h-13 flex-1 rounded-full bg-express-deep px-6 text-[17px] font-bold text-white disabled:opacity-60"
          @click="run(deleteAccount, onDeleted)"
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
    <div
      v-else-if="pendingWarning"
      role="alertdialog"
      aria-labelledby="logout-title"
      aria-describedby="logout-text"
      data-testid="logout-pending"
      class="flex max-w-xl flex-col gap-3 rounded-[18px] border-2 border-express bg-card px-4 py-[18px]"
    >
      <h3 id="logout-title" class="text-[22px] font-black text-express-deep">還有成績沒存到帳號</h3>
      <p id="logout-text" class="leading-relaxed">網路連上後會自動存。現在登出，這些成績會<strong>消失</strong>。</p>
      <div class="mt-1 flex flex-col gap-2 sm:flex-row">
        <button
          ref="stay"
          type="button"
          :disabled="busy"
          class="press min-h-13 flex-1 rounded-full bg-sign px-6 text-[17px] font-bold text-white disabled:opacity-60"
          @click="pendingWarning = false"
        >
          先不要登出
        </button>
        <button
          type="button"
          :disabled="busy"
          class="press min-h-13 flex-1 rounded-full border border-line bg-card px-6 text-[17px] font-bold text-express-deep disabled:opacity-60"
          @click="run(logout, onLoggedOut)"
        >
          仍要登出
        </button>
      </div>
    </div>
    <div v-else class="flex flex-wrap gap-3">
      <button type="button" :disabled="busy" :class="plain" @click="startLogout">登出</button>
      <button type="button" :disabled="busy" :class="`${plain} text-express-deep`" @click="confirming = true">
        刪除帳號
      </button>
    </div>
    <div v-if="failed" role="alert" class="max-w-xl rounded-[14px] border-[1.5px] border-express bg-edge-tint px-3.5 py-3">
      沒有成功，等一下再試一次。
    </div>
    <p v-if="!confirming && !pendingWarning" class="text-[15px] text-muted">
      刪除會把暱稱和帳號裡的紀錄全部刪掉，無法復原。這台裝置上的紀錄也會清掉。
    </p>
  </section>
</template>
