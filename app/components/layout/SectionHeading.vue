<script setup lang="ts">
/** 區塊標題：h2，右側可放一個「看更多」連結（action 插槽）。 */
defineProps<{ id?: string; title: string }>();
</script>

<template>
  <div class="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
    <h2 :id="id" class="text-xl font-extrabold text-ink sm:text-2xl">{{ title }}</h2>
    <slot name="action" />
  </div>
</template>
