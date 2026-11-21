<script setup lang="ts">
defineProps<{ rain: boolean }>();
</script>

<template>
  <span :style="{ color: rain ? '#8fb0ff' : '#ffc83d' }" class="inline-flex"><Icon :name="rain ? 'rain' : 'sun'" :size="15" /></span>
</template>
