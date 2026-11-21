<script setup lang="ts">
/** 內頁標題區：h1 加一段簡短說明。 */
defineProps<{ title: string; lead?: string }>();
</script>

<template>
  <div class="max-w-2xl">
    <h1 class="text-2xl font-extrabold text-sign sm:text-3xl">{{ title }}</h1>
    <p v-if="lead" class="mt-3 text-lg text-muted">{{ lead }}</p>
    <slot />
  </div>
</template>
