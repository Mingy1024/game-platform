<script setup lang="ts">
import { localeAlternates } from "@/lib/site-metadata";

usePageMeta(localeAlternates("zh-TW", "/"));
</script>

<template>
  <HomePage locale="zh-TW" />
</template>
