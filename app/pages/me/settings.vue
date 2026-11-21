<script setup lang="ts">
import { FLAGS } from "@/lib/flags";
import { t } from "@/lib/i18n/zh-TW";

/** 帳號設定：只有改暱稱（登出、刪除帳號在我的紀錄頁）。登入功能關閉時這一頁不存在。 */
definePageMeta({ validate: () => FLAGS.login });
usePageMeta({ title: "帳號設定", description: "修改在排行榜和成績圖上顯示的暱稱。", noindex: true });
</script>

<template>
  <Container class="py-6 sm:py-10">
    <div class="flex max-w-xl flex-col gap-4">
      <NuxtLink to="/me" class="flex min-h-11 items-center gap-1 self-start font-bold text-sign">
        <Icon name="left" :size="18" />
        我的紀錄
      </NuxtLink>
      <h1 class="-mt-1.5 text-[32px] font-black text-sign">帳號設定</h1>
      <NickSettings :labels="t.account" />
    </div>
  </Container>
</template>
