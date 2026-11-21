<script setup lang="ts">
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fmt } from "@/lib/i18n/format";

/** App 內建瀏覽器的提示：說明要用瀏覽器打開，附「複製連結」和三步驟 */
defineProps<{ labels: Dictionary["account"] }>();
const copied = ref(false);

async function copy() {
  try {
    await navigator.clipboard.writeText(window.location.href);
    copied.value = true;
    window.setTimeout(() => (copied.value = false), 2000);
  } catch {
    // 少數 App 不給寫剪貼簿；使用者還是可以照步驟從選單打開
  }
}
</script>

<template>
  <div class="flex w-full flex-col gap-3 rounded-[14px] bg-edge-tint p-3.5" data-testid="in-app-notice">
    <p class="text-[15px] leading-relaxed">
      <strong>{{ labels.inAppTitle }}</strong>
      <br >
      <span class="text-muted">{{ labels.inAppHint }}</span>
    </p>
    <ol class="list-decimal pl-5 text-[15px] leading-relaxed">
      <li>{{ fmt(labels.inAppStep1, { menu: "⋯" }) }}</li>
      <li>{{ labels.inAppStep2 }}</li>
      <li>{{ labels.inAppStep3 }}</li>
    </ol>
    <button
      type="button"
      aria-live="polite"
      class="press flex min-h-12 items-center justify-center gap-1.5 rounded-full bg-sign font-bold text-white hover:bg-sign-deep"
      @click="copy"
    >
      <Icon :name="copied ? 'check' : 'link'" :size="18" />
      {{ copied ? labels.copied : labels.copyLink }}
    </button>
  </div>
</template>
