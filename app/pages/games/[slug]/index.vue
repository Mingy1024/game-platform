<script setup lang="ts">
import { isGameRoute } from "~/utils/route-checks";
/** 遊戲介紹頁：/games/precise-stop（建置時預先產生） */
definePageMeta({ validate: isGameRoute });
const route = useRoute();
</script>

<template>
  <GamePage locale="zh-TW" :slug="String(route.params.slug)" />
</template>
