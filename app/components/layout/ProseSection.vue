<script setup lang="ts">
defineProps<{ title: string }>();
</script>

<template>
  <section>
    <h2 class="text-xl font-extrabold text-ink">{{ title }}</h2>
    <div class="mt-3 space-y-3 text-ink"><slot /></div>
  </section>
</template>
