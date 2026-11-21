<script setup lang="ts">
export type Crumb = { label: string; href?: string };

/** 最後一項是目前頁面，不加連結。 */
const { items, label = "麵包屑" } = defineProps<{ items: Crumb[]; label?: string }>();
</script>

<template>
  <nav :aria-label="label" class="text-sm text-muted">
    <ol class="flex flex-wrap items-center gap-x-1">
      <li v-for="(item, index) in items" :key="item.label" class="flex items-center gap-x-1">
        <NuxtLink
          v-if="item.href && index !== items.length - 1"
          :to="item.href"
          class="-mx-1 flex min-h-11 min-w-11 items-center justify-center px-1 font-semibold text-sign underline-offset-4 hover:underline"
        >
          {{ item.label }}
        </NuxtLink>
        <span v-else :aria-current="index === items.length - 1 ? 'page' : undefined">{{ item.label }}</span>
        <span v-if="index !== items.length - 1" aria-hidden="true">/</span>
      </li>
    </ol>
  </nav>
</template>
