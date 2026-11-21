<script setup lang="ts">
/** 這三頁目前只有繁體中文，所有語言都連到同一個網址 */
const links = [
  { href: "/games", key: "games" },
  { href: "/hot", key: "hot" },
  { href: "/me", key: "me" },
] as const;

const route = useRoute();
const dict = useDictionary();
const labels = computed(() => dict.value.nav);
const open = ref(false);
const panelId = useId();

const isActive = (href: string) => route.path === href || route.path.startsWith(`${href}/`);

function onKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape") open.value = false;
}
watch(open, (value) => {
  if (value) window.addEventListener("keydown", onKeyDown);
  else window.removeEventListener("keydown", onKeyDown);
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKeyDown));
// 換頁後收起選單
watch(() => route.fullPath, () => (open.value = false));
</script>

<!--
  導覽連結。桌面橫排；手機收進頁首下方的選單，不使用固定底部列，
  以免占用遊戲的觸控區。語言選單在兩種寬度都直接顯示。
-->
<template>
  <nav :aria-label="labels.label" class="flex shrink-0 items-center gap-1">
    <ul class="hidden items-center gap-1 md:flex">
      <li v-for="link in links" :key="link.href">
        <NuxtLink
          :to="link.href"
          :aria-current="isActive(link.href) ? 'page' : undefined"
          :class="`flex min-h-11 items-center whitespace-nowrap rounded-full px-4 font-semibold transition-colors ${
            isActive(link.href) ? 'bg-edge text-ink' : 'text-sign hover:bg-sign-tint'
          }`"
        >
          {{ labels[link.key] }}
        </NuxtLink>
      </li>
    </ul>

    <LanguageMenu />

    <button
      type="button"
      class="flex size-11 cursor-pointer items-center justify-center rounded-full text-sign hover:bg-sign-tint md:hidden"
      :aria-expanded="open"
      :aria-controls="panelId"
      :aria-label="open ? labels.closeMenu : labels.openMenu"
      @click="open = !open"
    >
      <Icon :name="open ? 'close' : 'menu'" :size="24" />
    </button>

    <div
      :id="panelId"
      :hidden="!open"
      class="absolute inset-x-0 top-full border-b border-line bg-card shadow-[0_12px_24px_-16px_rgb(20_23_31/0.35)] md:hidden"
    >
      <ul class="mx-auto max-w-[1200px] px-4 py-2">
        <li v-for="link in links" :key="link.href">
          <NuxtLink
            :to="link.href"
            :aria-current="isActive(link.href) ? 'page' : undefined"
            :class="`flex min-h-12 items-center rounded-xl px-3 text-lg font-semibold ${
              isActive(link.href) ? 'bg-edge-tint text-ink' : 'text-sign'
            }`"
            @click="open = false"
          >
            {{ labels[link.key] }}
          </NuxtLink>
        </li>
      </ul>
    </div>
  </nav>
</template>
