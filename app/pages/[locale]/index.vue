<script setup lang="ts">
import { isLocaleRoute } from "~/utils/route-checks";
import { localeAlternates } from "@/lib/site-metadata";

/** 其他語言的首頁：/en、/ja……；不是語言前綴的網址回 404 */
definePageMeta({ validate: isLocaleRoute });
const locale = useLocale();
usePageMeta(() => localeAlternates(locale.value, "/"));
</script>

<template>
  <HomePage :locale="locale" />
</template>
