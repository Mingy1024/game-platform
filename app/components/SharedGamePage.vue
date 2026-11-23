<script setup lang="ts">
import { sharedBanner as mineBanner, sharedMetadata as mineMetadata } from "@/lib/games/mine-descent/meta";
import { sharedBanner as officeBanner, sharedMetadata as officeMetadata } from "@/lib/games/office-escape/meta";
import { sharedBanner as preciseBanner, sharedMetadata as preciseMetadata } from "@/lib/games/precise-stop/meta";
import type { Locale } from "@/lib/i18n/locales";

/**
 * 成績連結的頁面：和介紹頁一樣，多一行朋友的分數；社群預覽圖是成績圖。
 * 代碼是任意值，所以這一頁在請求時才產生（不預先產生）。代碼無效時就是一般的介紹頁。
 */
const { locale, slug, code } = defineProps<{ locale: Locale; slug: string; code: string }>();
const mine = slug === "mine-descent";
const office = slug === "office-escape";
usePageMeta(mine ? mineMetadata(locale, slug, code) : office ? officeMetadata(locale, slug, code) : preciseMetadata(locale, slug, code));
const banner = mine ? mineBanner(locale, code) : office ? officeBanner(locale, code) : preciseBanner(locale, code);
</script>

<template>
  <MineDescentPage v-if="mine" :locale="locale">
    <template #banner>
      <p v-if="banner" data-testid="shared-banner" class="mt-4 rounded-xl border border-edge bg-edge-tint px-4 py-3 font-bold text-ink">
        {{ banner }}
      </p>
    </template>
  </MineDescentPage>
  <OfficeEscapePage v-else-if="office" :locale="locale">
    <template #banner>
      <p v-if="banner" data-testid="shared-banner" class="mt-4 rounded-xl border border-edge bg-edge-tint px-4 py-3 font-bold text-ink">
        {{ banner }}
      </p>
    </template>
  </OfficeEscapePage>
  <PreciseStopPage v-else :locale="locale">
    <template #banner>
      <p v-if="banner" data-testid="shared-banner" class="mt-4 rounded-xl border border-edge bg-edge-tint px-4 py-3 font-bold text-ink">
        {{ banner }}
      </p>
    </template>
  </PreciseStopPage>
</template>
