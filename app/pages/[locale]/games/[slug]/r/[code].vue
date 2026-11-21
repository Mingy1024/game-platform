<script setup lang="ts">
import { isLocaleRoute, isSharedRoute } from "~/utils/route-checks";
/** 其他語言的成績連結：/en/games/precise-stop/r/<代碼>…… */
definePageMeta({ validate: (route) => isLocaleRoute(route) && isSharedRoute(route) });
const route = useRoute();
const locale = useLocale();
</script>

<template>
  <SharedGamePage :locale="locale" :slug="String(route.params.slug)" :code="String(route.params.code)" />
</template>
