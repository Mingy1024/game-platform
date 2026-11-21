<script setup lang="ts">
import { u } from "~/games/precise-stop/shared";

defineProps<{
  icon: "rain" | "sun" | "slopeDown" | "slopeUp" | "flat" | "gauge";
  tint: string;
  color: string;
  title: string;
  body: string;
}>();
</script>

<template>
  <div class="flex items-center" :style="{ gap: u(12) }">
    <span
      class="flex shrink-0 items-center justify-center"
      :style="{ width: u(40), height: u(40), borderRadius: u(12), background: tint, color }"
    >
      <Icon :name="icon" :size="22" />
    </span>
    <div class="min-w-0">
      <p :style="{ fontSize: u(17), fontWeight: 900, lineHeight: 1.3 }">{{ title }}</p>
      <p :style="{ fontSize: u(14), color: '#c9cfd8', lineHeight: 1.4 }">{{ body }}</p>
    </div>
  </div>
</template>
