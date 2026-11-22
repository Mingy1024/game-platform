<script setup lang="ts">
import { nickText } from "@/lib/account/nick/nick";
import { FLAGS } from "@/lib/flags";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * 我的紀錄頁（只有繁體中文）的帳號部分：最上面的帳號卡、最下面的登出與刪除帳號
 * （排行榜的訪客是刪除訪客紀錄、歐盟地區的上榜開關，GuestActions.vue）。
 * 預設插槽是中間原本的紀錄區塊。
 */
defineProps<{ labels: Dictionary["account"] }>();
const me = useMe();
const notice = ref<"loggedOut" | "deleted" | null>(null);
let timer = 0;

watch(notice, (value) => {
  window.clearTimeout(timer);
  if (value) timer = window.setTimeout(() => (notice.value = null), 5000);
});
onBeforeUnmount(() => window.clearTimeout(timer));
</script>

<template>
  <div v-if="notice" class="mt-6">
    <Banner tone="info" closable :close-label="labels.close" @close="notice = null">
      {{ notice === "loggedOut" ? "已經登出了。" : "已經刪除了。" }}
    </Banner>
  </div>

  <AccountCard :labels="labels" />

  <slot />

  <AccountActions
    v-if="me.status === 'loggedIn'"
    :nick="nickText(me.nick, 'zh-TW')"
    :on-logged-out="() => (notice = 'loggedOut')"
    :on-deleted="() => (notice = 'deleted')"
  />
  <GuestActions
    v-else-if="FLAGS.leaderboard && me.status === 'loggedOut' && (me.guest || me.consentRequired)"
    :nick="me.guest ? nickText(me.guest.nick, 'zh-TW') : null"
    :consent-required="me.consentRequired"
    :on-deleted="() => (notice = 'deleted')"
  />
</template>
