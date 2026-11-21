<script setup lang="ts">
defineProps<{ done: boolean; active: boolean; size: number }>();
</script>

<template>
  <span
    class="box-border block shrink-0 rounded-full border-4"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      background: done || active ? '#ffc83d' : '#fff',
      borderColor: active ? '#cc4409' : '#152b6b',
    }"
  />
</template>
