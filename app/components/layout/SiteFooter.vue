<script setup lang="ts">
import { FLAGS } from "@/lib/flags";

/** 這幾頁目前只有繁體中文 */
const links = [
  { href: "/about", key: "about" },
  { href: "/privacy", key: "privacy" },
  { href: "/terms", key: "terms" },
  { href: "/contact", key: "contact" },
] as const;

const dict = useDictionary();
</script>

<template>
  <footer class="on-dark mt-24 bg-sign-deep text-white">
    <Container class="flex flex-col gap-6 py-10 md:flex-row md:items-start md:justify-between">
      <div class="max-w-md">
        <p class="text-lg font-extrabold tracking-wide">{{ dict.brand }}</p>
        <p class="mt-1 text-white/85">{{ dict.tagline }}</p>
        <p class="mt-4 text-sm text-white/75">
          {{ FLAGS.login ? dict.footer.deviceNoteLoggedOut : dict.footer.deviceNote }}
        </p>
      </div>
      <nav :aria-label="dict.footer.label">
        <ul class="flex flex-wrap gap-x-2 gap-y-1">
          <li v-for="link in links" :key="link.href">
            <NuxtLink
              :to="link.href"
              class="flex min-h-11 items-center rounded-full px-3 font-semibold underline-offset-4 hover:underline"
            >
              {{ dict.footer[link.key] }}
            </NuxtLink>
          </li>
        </ul>
      </nav>
    </Container>
  </footer>
</template>
