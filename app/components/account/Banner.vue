<script setup lang="ts">
/** 提示條外框：ok 綠、error 橘、info 藍。closable 時右側有關閉鈕（發出 close）。 */
const { tone, closable = false } = defineProps<{ tone: "ok" | "error" | "info"; closeLabel: string; closable?: boolean }>();
defineEmits<{ close: [] }>();

const look = computed(
  () =>
    ({
      ok: "border-[1.5px] border-signal bg-signal-tint",
      error: "border-[1.5px] border-express bg-edge-tint",
      info: "bg-sign-tint",
    })[tone],
);
</script>

<template>
  <div
    :role="tone === 'error' ? 'alert' : 'status'"
    :data-testid="`banner-${tone}`"
    :class="`flex items-center gap-3 rounded-[14px] py-2.5 pl-3.5 pr-2 ${look}`"
  >
    <svg v-if="tone === 'ok'" aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--signal)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
      <circle cx="12" cy="12" r="9.5" />
      <path d="M7.5 12.3l3 3 6-6.3" />
    </svg>
    <svg v-else-if="tone === 'error'" aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--express-deep)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 7.5v5.5M12 16.5v.2" />
    </svg>
    <p class="min-w-0 flex-1 leading-normal"><slot /></p>
    <slot name="action" />
    <button
      v-if="closable"
      type="button"
      :aria-label="closeLabel"
      class="flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-black/5"
      @click="$emit('close')"
    >
      <Icon name="close" :size="20" />
    </button>
  </div>
</template>
