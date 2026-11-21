<script setup lang="ts">
import { isGameRoute, isLocaleRoute } from "~/utils/route-checks";
/** 其他語言的遊戲介紹頁：/en/games/precise-stop……（建置時預先產生） */
definePageMeta({ validate: (route) => isLocaleRoute(route) && isGameRoute(route) });
const route = useRoute();
const locale = useLocale();
</script>

<template>
  <GamePage :locale="locale" :slug="String(route.params.slug)" />
</template>
