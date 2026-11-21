<script setup lang="ts">
import { fmt } from "@/lib/i18n/format";
import { LOCALES, LOCALE_COOKIE, localeInfo, switchLocalePath, type Locale } from "@/lib/i18n/locales";

/**
 * 語言選單。電腦是按鈕下方的下拉清單，手機是從底部升起的面板。
 * 每個語言只用自己的寫法列出；選了之後留在同一頁（該頁沒有翻譯時回到首頁）。
 */
const locale = useLocale();
const dict = useDictionary();
const route = useRoute();
const labels = computed(() => dict.value.nav);
const current = computed(() => localeInfo[locale.value]);
const open = ref(false);
const panelId = useId();
const root = useTemplateRef<HTMLDivElement>("root");
const button = useTemplateRef<HTMLButtonElement>("button");

/** 記住使用者自己選的語言，下次從首頁進來沿用（不依瀏覽器語言自動跳轉） */
function remember(target: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${target}; path=/; max-age=31536000; samesite=lax`;
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    open.value = false;
    button.value?.focus();
  }
}
function onPointerDown(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node)) open.value = false;
}
function listen(on: boolean) {
  const method = on ? "addEventListener" : "removeEventListener";
  window[method]("keydown", onKeyDown as EventListener);
  window[method]("pointerdown", onPointerDown as EventListener);
}
watch(open, listen);
onBeforeUnmount(() => listen(false));
</script>

<template>
  <div ref="root" class="md:relative">
    <button
      ref="button"
      type="button"
      aria-haspopup="true"
      :aria-expanded="open"
      :aria-controls="panelId"
      :aria-label="fmt(labels.languageSwitch, { name: current.nativeName })"
      data-testid="language-button"
      class="flex min-h-11 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 font-semibold text-ink hover:bg-sign-tint md:border md:border-line md:px-3"
      @click="open = !open"
    >
      <Icon name="globe" :size="20" />
      <span class="text-sm md:hidden">{{ current.shortName }}</span>
      <span class="hidden md:inline">{{ current.nativeName }}</span>
      <Icon name="down" :size="14" class="hidden md:block" />
    </button>

    <template v-if="open">
      <div class="fixed inset-0 z-40 bg-canvas/55 md:hidden" aria-hidden="true" />
      <div
        :id="panelId"
        role="dialog"
        :aria-label="labels.language"
        class="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-card px-4 pb-5 pt-2.5 shadow-[0_-12px_32px_rgb(16_19_26/0.18)] md:absolute md:inset-x-auto md:bottom-auto md:right-0 md:top-full md:mt-2 md:w-56 md:rounded-2xl md:border md:border-line md:p-2 md:shadow-[0_12px_32px_rgb(16_19_26/0.18)]"
      >
        <div class="md:hidden">
          <span class="mx-auto block h-1.5 w-10 rounded-full bg-line" aria-hidden="true" />
          <div class="flex items-center justify-between px-1 pb-1.5 pt-1">
            <p class="text-xl font-extrabold text-sign">{{ labels.language }}</p>
            <button
              type="button"
              :aria-label="labels.close"
              class="flex size-11 cursor-pointer items-center justify-center rounded-full text-muted"
              @click="open = false"
            >
              <Icon name="close" :size="22" />
            </button>
          </div>
        </div>
        <ul class="flex flex-col gap-0.5">
          <li v-for="item in LOCALES" :key="item">
            <!-- 換語言用一般連結整頁切換（<html lang>、字型都會跟著換） -->
            <a
              :href="switchLocalePath(route.path, item)"
              :lang="localeInfo[item].htmlLang"
              :hreflang="localeInfo[item].htmlLang"
              :aria-current="item === locale ? 'true' : undefined"
              :class="`flex min-h-13 items-center justify-between gap-3 rounded-xl px-4 text-lg md:min-h-11 md:px-3 md:text-base ${
                item === locale ? 'bg-sign-tint font-extrabold text-sign' : 'font-semibold text-ink hover:bg-platform'
              }`"
              @click="remember(item)"
            >
              {{ localeInfo[item].nativeName }}
              <Icon v-if="item === locale" name="check" :size="18" />
            </a>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
