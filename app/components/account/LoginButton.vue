<script setup lang="ts">
import { detectInAppBrowser, externalBrowserUrl } from "@/lib/account/in-app-browser";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const sizes = {
  md: { button: "min-h-12 gap-2 py-1.5 pl-2 pr-4 text-base", mark: "size-8", icon: 18 },
  lg: { button: "min-h-13 gap-2.5 py-1.5 pl-2 pr-5 text-[17px]", mark: "size-9", icon: 20 },
} as const;

/**
 * 「用 Google 登入」按鈕。在 LINE、Facebook、Instagram、Threads 的內建瀏覽器裡，
 * 改顯示「用瀏覽器打開」的提示（Android 版 LINE 則直接換成跳出去的按鈕）。
 */
const { size = "md" } = defineProps<{ labels: Dictionary["account"]; size?: keyof typeof sizes }>();
const inApp = useClientValue(() => detectInAppBrowser(navigator.userAgent));
const style = computed(() => sizes[size]);
const look = computed(
  () => `press inline-flex shrink-0 items-center rounded-full bg-sign font-bold text-white hover:bg-sign-deep ${style.value.button}`,
);
const externalHref = () => externalBrowserUrl(window.location.href);
</script>

<template>
  <InAppNotice v-if="inApp === 'other'" :labels="labels" />
  <a v-else-if="inApp === 'line-android'" :href="externalHref()" :class="look" data-testid="login-button">
    <span :class="`flex items-center justify-center rounded-full bg-card text-sign ${style.mark}`">
      <Icon name="globe" :size="style.icon" />
    </span>
    {{ labels.openBrowser }}
  </a>
  <a v-else :href="LOGIN_FALLBACK_HREF" :class="look" data-testid="login-button" @click="pointLoginToCurrentPage">
    <span :class="`flex items-center justify-center rounded-full bg-card ${style.mark}`">
      <GoogleMark :size="style.icon" />
    </span>
    {{ labels.login }}
  </a>
</template>
