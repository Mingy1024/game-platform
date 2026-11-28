<script setup lang="ts">
export type Crumb = { label: string; href?: string };

/**
 * 最後一項是目前頁面，不加連結。
 * 點擊範圍用不佔版面的透明擴大區撐到 44×44：連結本身用 min-w-11 撐寬的話，
 * 只有一個字的「홈」左右會多出一大段空白（2026-11-28 七語版面檢查）。
 */
const { items, label = "麵包屑" } = defineProps<{ items: Crumb[]; label?: string }>();
</script>

<template>
  <nav :aria-label="label" class="text-sm text-muted">
    <ol class="flex flex-wrap items-center gap-x-1">
      <li v-for="(item, index) in items" :key="item.label" class="flex items-center gap-x-1">
        <NuxtLink
          v-if="item.href && index !== items.length - 1"
          :to="item.href"
          class="relative flex min-h-11 items-center font-semibold text-sign underline-offset-4 before:absolute before:top-1/2 before:left-1/2 before:size-11 before:-translate-x-1/2 before:-translate-y-1/2 hover:underline"
        >
          {{ item.label }}
        </NuxtLink>
        <span v-else :aria-current="index === items.length - 1 ? 'page' : undefined">{{ item.label }}</span>
        <span v-if="index !== items.length - 1" aria-hidden="true">/</span>
      </li>
    </ol>
  </nav>
</template>
