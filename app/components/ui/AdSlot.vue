<script setup lang="ts">
import { t } from "@/lib/i18n/zh-TW";

/**
 * 廣告版位。slot ID 與規則對應規劃文件第 11 節。
 * 目前只有 mock 外觀：預留固定高度、清楚標示「廣告」。
 * ADS_MODE=off 不輸出；live 尚未串接供應商，同樣不輸出，避免載入未核准的程式。
 * （ADS_MODE 在建置時決定，見 nuxt.config.ts）
 */
const slots = {
  "home-content": { enabled: true, size: "h-[250px] sm:h-[120px]", mobile: true },
  "catalog-content": { enabled: true, size: "h-[250px] sm:h-[120px]", mobile: true },
  "game-guide": { enabled: true, size: "h-[250px] sm:h-[120px]", mobile: true },
  /** 桌面側欄：預設關閉，手機完全不顯示 */
  "game-sidebar": { enabled: false, size: "h-[600px]", mobile: false },
} as const;

const {
  slotId,
  label = t.ads.label,
  mockText = t.ads.mock,
} = defineProps<{
  slotId: keyof typeof slots;
  /** 其他語言的頁面傳入翻譯後的文字 */
  label?: string;
  mockText?: string;
}>();

const mode = process.env.ADS_MODE ?? "mock";
const config = computed(() => slots[slotId]);
</script>

<template>
  <aside
    v-if="mode === 'mock' && config.enabled"
    :aria-label="label"
    :data-ad-slot="slotId"
    :class="config.mobile ? '' : 'hidden lg:block'"
  >
    <p class="mb-1 text-sm text-muted">{{ label }}</p>
    <div
      :class="`flex items-center justify-center rounded-xl border-2 border-dashed border-line bg-card text-sm text-muted ${config.size}`"
    >
      {{ mockText }}（{{ slotId }}）
    </div>
  </aside>
</template>
