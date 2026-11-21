<script setup lang="ts">
import type { Category } from "@/lib/catalog/categories";

/** 分類入口：每個分類一塊站牌樣式的連結。 */
defineProps<{ categories: Category[]; currentSlug?: string }>();
</script>

<template>
  <ul class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    <li v-for="category in categories" :key="category.slug">
      <NuxtLink
        :to="`/categories/${category.slug}`"
        :aria-current="category.slug === currentSlug ? 'page' : undefined"
        :class="`press flex h-full min-h-20 flex-col justify-center rounded-xl border-l-8 px-4 py-3 ${
          category.slug === currentSlug
            ? 'border-edge bg-edge-tint'
            : 'border-sign bg-card ring-1 ring-inset ring-line hover:bg-sign-tint'
        }`"
      >
        <span class="text-lg font-extrabold text-ink">{{ category.name }}</span>
        <span class="text-sm text-muted">{{ category.summary }}</span>
      </NuxtLink>
    </li>
  </ul>
</template>
