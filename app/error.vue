<script setup lang="ts">
import type { NuxtError } from "#app";
import { t } from "@/lib/i18n/zh-TW";

/** 找不到頁面（404）和其他錯誤。網址對不到任何頁面時也是這一頁。 */
const props = defineProps<{ error: NuxtError }>();
const notFound = computed(() => props.error.statusCode === 404);
useHead({ title: computed(() => (notFound.value ? "找不到這個頁面" : "發生錯誤")) });
</script>

<template>
  <NuxtLayout>
    <Container class="py-16 text-center sm:py-24">
      <p class="text-4xl font-black tabular-nums text-sign">{{ error.statusCode }}</p>
      <template v-if="notFound">
        <h1 class="mt-2 text-2xl font-extrabold text-ink sm:text-3xl">這一站沒有停靠</h1>
        <p class="mx-auto mt-3 max-w-md text-lg text-muted">找不到這個頁面。網址可能打錯了，或這款遊戲已經下架。</p>
      </template>
      <template v-else>
        <h1 class="mt-2 text-2xl font-extrabold text-ink sm:text-3xl">列車暫停運行</h1>
        <p class="mx-auto mt-3 max-w-md text-lg text-muted">網站出了點問題，請稍後再試一次。</p>
      </template>
      <div class="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/games">{{ t.actions.allGames }}</ButtonLink>
        <ButtonLink href="/" variant="secondary">{{ t.actions.backHome }}</ButtonLink>
      </div>
    </Container>
  </NuxtLayout>
</template>
