<script setup lang="ts">
import { isSharedRoute } from "~/utils/route-checks";
/** 成績連結：/games/precise-stop/r/<代碼> */
definePageMeta({ validate: isSharedRoute });
const route = useRoute();
</script>

<template>
  <SharedGamePage locale="zh-TW" :slug="String(route.params.slug)" :code="String(route.params.code)" />
</template>
