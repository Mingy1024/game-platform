<script setup lang="ts">
import { SITE_NOINDEX } from "@/lib/site-metadata";

// 測試站（SITE_NOINDEX=1）全站不讓搜尋引擎收錄
if (SITE_NOINDEX) useHead({ meta: [{ name: "robots", content: "noindex, nofollow" }] });
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
