<script setup lang="ts">
import { FLAGS } from "@/lib/flags";
import { localeFontFamily } from "@/lib/i18n/fonts";
import { localeInfo } from "@/lib/i18n/locales";
import { siteMetadata } from "@/lib/site-metadata";

/**
 * 整個頁面的外框：<html> 的語言與字型、頁首、主要內容、頁尾。
 * 所有語言共用，差別只在語言和主要字型。
 */
const locale = useLocale();
const dict = useDictionary();

useHead(() => {
  const site = siteMetadata(locale.value);
  const font = localeFontFamily(locale.value);
  return {
    htmlAttrs: {
      lang: localeInfo[locale.value].htmlLang,
      class: "h-full antialiased",
      style: font ? `--font-locale: ${font}` : undefined,
    },
    bodyAttrs: { class: "min-h-full" },
    titleTemplate: (title?: string) => (title ? site.titleTemplate.replace("%s", title) : site.defaultTitle),
    meta: [{ name: "description", content: site.description }],
  };
});
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-sign focus:px-5 focus:py-3 focus:font-bold focus:text-white"
    >
      {{ dict.nav.skipToContent }}
    </a>
    <SiteHeader />
    <main id="main" class="flex-1">
      <LoginResultBanner v-if="FLAGS.login" :locale="locale" :labels="dict.account" />
      <slot />
    </main>
    <SiteFooter />
  </div>
</template>
