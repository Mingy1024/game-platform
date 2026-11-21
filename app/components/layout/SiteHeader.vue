<script setup lang="ts">
import { localePath } from "@/lib/i18n/locales";

const locale = useLocale();
const dict = useDictionary();
</script>

<template>
  <header class="sticky top-0 z-40 bg-card">
    <Container class="relative flex h-16 items-center justify-between gap-2">
      <NuxtLink
        :to="localePath(locale, '/')"
        class="flex min-h-11 min-w-0 items-center gap-2.5 text-lg font-extrabold tracking-wide text-sign sm:text-xl"
      >
        <svg aria-hidden="true" width="32" height="32" viewBox="0 0 32 32" class="shrink-0">
          <rect width="32" height="32" rx="9" fill="var(--sign)" />
          <path d="M5 16h22" stroke="#fff" stroke-width="3" stroke-linecap="round" />
          <circle cx="16" cy="16" r="6" fill="var(--edge)" stroke="#fff" stroke-width="3" />
        </svg>
        <span class="truncate">{{ dict.brand }}</span>
      </NuxtLink>
      <HeaderNav />
    </Container>
    <div class="platform-edge" aria-hidden="true" />
  </header>
</template>
