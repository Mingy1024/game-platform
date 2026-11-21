<script setup lang="ts">
import { detectInAppBrowser } from "@/lib/account/in-app-browser";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";

/**
 * 遊戲介紹頁「我的紀錄」卡下方的帳號區塊（設計稿「紀錄卡」畫板）。
 * 未登入：說明紀錄只在這台裝置＋登入按鈕；已登入：暱稱＋改暱稱。
 */
defineProps<{
  locale: Locale;
  labels: Dictionary["account"];
  records: { deviceOnly: string; loginHint: string };
}>();
const me = useMe();
const inApp = useClientValue(() => detectInAppBrowser(navigator.userAgent));
</script>

<template>
  <!-- 還不知道有沒有登入：先佔好位置，避免畫面跳動 -->
  <div v-if="me.status === 'loading'" aria-hidden="true" class="mx-4 mb-4 min-h-[72px] rounded-[14px] bg-platform" />

  <div
    v-else-if="me.status === 'loggedIn'"
    data-testid="records-logged-in"
    class="mx-4 mb-4 flex items-center gap-3 rounded-[14px] bg-signal-tint px-3.5 py-3"
  >
    <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-signal text-white">
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </span>
    <p class="min-w-0 flex-1 text-[15px] leading-normal">
      <span class="font-bold text-signal">{{ labels.loggedIn }}</span>
      <br >
      <span class="text-muted">{{ labels.nickLabel }}</span>{{ " " }}<NickName :nick="me.nick" :locale="locale" class="text-[17px]" number-class="text-[15px]" />
    </p>
    <NuxtLink
      to="/me/settings"
      class="press flex min-h-11 shrink-0 items-center rounded-full border border-line bg-card px-3.5 text-[15px] font-bold text-sign"
    >
      {{ labels.changeNick }}
    </NuxtLink>
  </div>

  <div v-else class="mx-4 mb-4 flex flex-col gap-2.5" data-testid="login-hint">
    <InAppNotice v-if="inApp === 'other'" :labels="labels" />
    <div v-else class="flex flex-wrap items-center gap-3 rounded-[14px] bg-sign-tint px-3.5 py-3">
      <p class="min-w-[12rem] flex-1 text-[15px] leading-normal">
        <strong>{{ records.deviceOnly }}</strong>
        <br >
        <span class="text-muted">{{ records.loginHint }}</span>
      </p>
      <LoginButton :labels="labels" />
    </div>
    <p class="text-sm text-muted">
      {{ labels.privacyNote }}<NuxtLink to="/privacy" class="font-bold text-sign underline underline-offset-2">{{ labels.privacyLink }}</NuxtLink>
    </p>
  </div>
</template>
