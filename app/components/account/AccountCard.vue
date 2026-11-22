<script setup lang="ts">
import { detectInAppBrowser } from "@/lib/account/in-app-browser";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/** 我的紀錄頁最上面的帳號卡 */
defineProps<{ labels: Dictionary["account"] }>();
const me = useMe();
const inApp = useClientValue(() => detectInAppBrowser(navigator.userAgent));
const card = "mt-6 flex flex-wrap items-center gap-x-6 gap-y-4 rounded-[20px] border border-line bg-card px-6 py-5";
</script>

<template>
  <div v-if="me.status === 'loading'" aria-hidden="true" :class="`${card} min-h-[118px]`" />

  <section v-else-if="me.status === 'loggedIn'" aria-labelledby="account-title" :class="card" data-testid="me-account">
    <div class="flex min-w-0 flex-[999_1_26rem] flex-col gap-1">
      <h2 id="account-title" class="text-[15px] font-bold text-muted">{{ labels.nickLabel }}</h2>
      <p class="text-[30px] leading-tight">
        <NickName :nick="me.nick" locale="zh-TW" number-class="text-[22px]" />
      </p>
      <p class="mt-0.5 flex items-center gap-1.5 text-[15px] font-bold text-signal">
        <Icon name="check" :size="18" />
        已用 Google 登入，只存帳號代碼
      </p>
    </div>
    <NuxtLink
      to="/me/settings"
      class="press inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-card px-5 font-bold text-sign ring-[1.5px] ring-inset ring-sign hover:bg-sign-tint"
    >
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 20h4L19 9l-4-4L4 16v4z" />
      </svg>
      {{ labels.changeNick }}
    </NuxtLink>
  </section>

  <!-- 排行榜的訪客（精準停車設計稿第 35 張，T12） -->
  <section
    v-else-if="me.status === 'loggedOut' && me.guest"
    aria-labelledby="account-title"
    :class="card"
    data-testid="me-account"
    data-guest="true"
  >
    <div class="flex min-w-0 flex-[999_1_26rem] flex-col gap-1">
      <h2 id="account-title" class="text-[15px] font-bold text-muted">{{ labels.nickLabel }}</h2>
      <p class="flex flex-wrap items-center gap-x-2 text-[30px] leading-tight">
        <NickName :nick="me.guest.nick" locale="zh-TW" number-class="text-[22px]" />
        <span data-testid="guest-badge" class="rounded-full border border-[#a3adbd] px-2 text-sm font-bold leading-[22px] text-muted">訪客</span>
      </p>
      <p class="mt-0.5 text-[15px] leading-relaxed text-muted">
        訪客的紀錄 90 天沒玩會自動刪除。用 Google 登入，紀錄會併進帳號、永久保留。{{ labels.privacyNote }}<NuxtLink to="/privacy" class="font-bold text-sign underline underline-offset-2">{{ labels.privacyLink }}</NuxtLink>
      </p>
    </div>
    <InAppNotice v-if="inApp === 'other'" :labels="labels" />
    <LoginButton v-else :labels="labels" size="lg" />
  </section>

  <section v-else aria-labelledby="account-title" :class="card" data-testid="me-account">
    <div class="min-w-0 flex-[999_1_26rem]">
      <h2 id="account-title" class="text-xl font-extrabold">還沒登入</h2>
      <p class="mt-1.5 leading-relaxed text-muted">
        下面的紀錄只存在這台裝置的瀏覽器，清除瀏覽器資料就會消失。用 Google 登入，之後就能保留在帳號裡。{{ labels.privacyNote }}<NuxtLink to="/privacy" class="font-bold text-sign underline underline-offset-2">{{ labels.privacyLink }}</NuxtLink>
      </p>
    </div>
    <InAppNotice v-if="inApp === 'other'" :labels="labels" />
    <LoginButton v-else :labels="labels" size="lg" />
  </section>
</template>
