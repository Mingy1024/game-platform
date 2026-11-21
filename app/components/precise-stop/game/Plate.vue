<script setup lang="ts">
import { u } from "~/games/precise-stop/shared";

/** 站牌樣式的文字牌：圓角、白色內框、頂部淡高光，不傾斜。tag：掛在牌子上緣的小籤條 */
const { from, to, size = 30 } = defineProps<{ from: string; to: string; tag?: string; size?: number }>();
const style = computed(() => ({
  fontSize: u(size),
  lineHeight: 1,
  padding: `${u(size * 0.38)} ${u(size * 0.65)}`,
  borderRadius: u(size * 0.52),
  background: `linear-gradient(${from}, ${to})`,
  boxShadow: `inset 0 0 0 ${u(3)} ${from}, inset 0 0 0 ${u(5)} rgba(255,255,255,0.85), inset 0 ${u(size * 0.5)} 0 ${u(-size * 0.2)} rgba(255,255,255,0.16), 0 ${u(6)} ${u(10)} rgba(16,19,26,0.35)`,
  gap: u(size * 0.3),
}));
const tagStyle = computed(() => ({
  top: u(-size * 0.42),
  fontSize: u(size * 0.46),
  padding: `${u(2)} ${u(size * 0.4)}`,
  background: "#ffc83d",
  border: `${u(2)} solid #fff`,
}));
</script>

<template>
  <span class="relative inline-flex max-w-[80cqw] items-center justify-center whitespace-nowrap font-black text-white" :style="style">
    <span v-if="tag" class="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full font-black text-ink" :style="tagStyle">
      {{ tag }}
    </span>
    <slot />
  </span>
</template>
