<script setup lang="ts">
import type { Dictionary } from "@/lib/i18n/dictionaries";

/** 帳號設定頁（只有繁體中文）：只有改暱稱 */
defineProps<{ labels: Dictionary["account"] }>();
const me = useMe();
</script>

<template>
  <div v-if="me.status === 'loading'" aria-hidden="true" class="min-h-[420px]" />
  <section
    v-else-if="me.status !== 'loggedIn'"
    class="flex flex-col items-start gap-4 rounded-[18px] border border-line bg-card px-4 py-[18px] sm:px-6"
    data-testid="settings-logged-out"
  >
    <p class="text-lg font-bold">用 Google 登入才能自訂暱稱</p>
    <LoginButton :labels="labels" size="lg" />
  </section>
  <template v-else>
    <p class="-mt-2 flex items-center gap-1.5 text-sm font-bold text-signal">
      <Icon name="check" :size="16" />
      已用 Google 登入，只存帳號代碼
    </p>
    <NickForm :current="me.nick" :next-at="me.nickNextAt" />
  </template>
</template>
