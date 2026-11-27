<script setup lang="ts">
import { getCategoriesOfGame, getGameBySlug } from "@/lib/catalog/catalog";
import { localizeCategory } from "@/lib/catalog/localize";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localePath, type Locale } from "@/lib/i18n/locales";

const HERO = "/games/mine-descent/0.1.0/hero.webp";
const card = "rounded-[18px] border border-line bg-card p-5";
const cardTitle = "text-xl font-extrabold text-ink";

/**
 * 礦坑大逃亡的介紹頁。按下出發看板的「開始逃生」後，整頁換成遊戲畫面（網址不變）。
 * banner 插槽：從朋友的成績連結進來時，顯示對方分數的那一行。
 */
const { locale } = defineProps<{ locale: Locale }>();
const dict = getDictionary(locale);
const text = dict.mineDescent;
const game = getGameBySlug("mine-descent");
const categories = game ? getCategoriesOfGame(game).map((category) => localizeCategory(category, dict)) : [];
const keys = text.howTo.keys;
const keyChips = [
  [keys.touch, keys.touchValue],
  [keys.desktop, keys.desktopValue],
  [keys.pause, "P／Esc"],
  [keys.restart, "R"],
  [keys.fullscreen, "F"],
];

// 主視覺在第一屏：優先下載
useHead({ link: [{ rel: "preload", as: "image", href: HERO, fetchpriority: "high" }] });
</script>

<template>
  <MineDescentExperience :locale="locale">
    <Container class="py-5 sm:py-8">
      <Breadcrumb
        :label="dict.breadcrumb.label"
        :items="[
          { label: dict.breadcrumb.home, href: localePath(locale, '/') },
          { label: dict.nav.games, href: '/games' },
          { label: text.title },
        ]"
      />

      <header class="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 class="text-2xl font-extrabold text-sign sm:text-3xl">{{ text.title }}</h1>
        <p class="basis-full text-muted lg:basis-auto lg:text-lg">{{ text.lead }}</p>
        <ul class="flex flex-wrap items-center gap-2 lg:ml-auto">
          <li v-for="category in categories" :key="category.slug">
            <NuxtLink
              :to="`/categories/${category.slug}`"
              class="flex min-h-11 items-center rounded-full bg-sign-tint px-4 font-semibold text-sign hover:bg-edge-tint"
            >
              {{ category.name }}
            </NuxtLink>
          </li>
          <li class="empty:hidden"><PlayCount slug="mine-descent" :locale="locale" /></li>
        </ul>
      </header>

      <slot name="banner" />

      <div class="mt-4 flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-6">
        <div class="relative aspect-square w-full max-w-[460px] shrink-0 self-center overflow-hidden rounded-[18px] bg-canvas lg:aspect-auto lg:min-h-[560px] lg:w-[420px] lg:max-w-none lg:self-auto">
          <img :src="HERO" :alt="text.heroAlt" fetchpriority="high" class="absolute inset-0 size-full object-cover object-[50%_43%] lg:object-[50%_52%]">
          <span class="absolute bottom-3.5 left-3.5 rounded-full bg-canvas/80 px-3 py-1 text-sm font-bold text-white">{{ text.chip }}</span>
        </div>
        <div class="flex min-w-0 flex-1 flex-col gap-4">
          <DescentBoard />
          <MineRecordsCard />
        </div>
      </div>

      <section aria-labelledby="howto-title" :class="`mt-7 ${card}`">
        <h2 id="howto-title" :class="cardTitle">{{ text.howTo.title }}</h2>
        <ol class="mt-4 grid gap-4 md:grid-cols-3 md:gap-6">
          <li v-for="(step, index) in text.howTo.steps" :key="step.title" class="flex gap-3">
            <span
              aria-hidden="true"
              :class="`flex size-8 shrink-0 items-center justify-center rounded-full font-black text-white ${index === 2 ? 'bg-signal' : 'bg-sign'}`"
              >{{ index + 1 }}</span
            >
            <div>
              <h3 class="text-lg font-extrabold">{{ step.title }}</h3>
              <p class="mt-0.5 text-muted">{{ step.body }}</p>
            </div>
          </li>
        </ol>
        <ul class="mt-5 flex flex-wrap gap-2 border-t border-line pt-4 text-sm">
          <li v-for="[label, value] in keyChips" :key="label" class="flex items-center gap-1.5 rounded-full border border-line bg-platform px-3 py-1.5">
            <strong>{{ label }}</strong>
            <span class="text-muted">{{ value }}</span>
          </li>
        </ul>
      </section>

      <!-- 唯一的廣告版位：放在玩法和計分之間；遊戲畫面裡沒有廣告 -->
      <AdSlot slot-id="game-guide" class="mt-7" :label="dict.ads.label" :mock-text="dict.ads.mock" />

      <div class="mt-7 grid gap-4 md:grid-cols-2">
        <section aria-labelledby="scoring-title" :class="card">
          <h2 id="scoring-title" :class="cardTitle">{{ text.scoring.title }}</h2>
          <table class="mt-3 w-full">
            <tbody>
              <tr v-for="row in text.scoring.rows" :key="row.label" class="border-b border-line">
                <th scope="row" class="py-2 pr-3 text-left font-extrabold text-sign">{{ row.label }}</th>
                <td class="py-2 text-muted">{{ row.value }}</td>
              </tr>
              <tr v-for="row in text.scoring.multipliers" :key="row.label" class="border-b border-line">
                <th scope="row" class="py-2 pr-3 text-left font-extrabold text-signal">{{ row.label }}</th>
                <td class="py-2 text-muted">{{ row.value }}</td>
              </tr>
            </tbody>
          </table>
          <p class="mt-3 text-sm text-muted">{{ text.scoring.note }}</p>
        </section>

        <section aria-labelledby="faq-title" :class="card">
          <h2 id="faq-title" :class="cardTitle">{{ text.faq.title }}</h2>
          <div class="mt-1">
            <details v-for="(item, index) in text.faq.items" :key="item.question" :open="index === 0" class="border-b border-line py-2.5">
              <summary class="flex min-h-11 cursor-pointer items-center font-extrabold">{{ item.question }}</summary>
              <p class="pb-1 text-sm text-muted">{{ item.answer }}</p>
            </details>
          </div>
          <h3 class="mt-4 text-sm font-extrabold text-ink">{{ text.faq.changelog }}</h3>
          <ul class="mt-1 text-sm text-muted">
            <li v-for="entry in text.faq.changelogItems" :key="entry.date" class="flex flex-wrap gap-x-3">
              <time :datetime="entry.date" class="font-bold tabular-nums">{{ entry.date }}</time>
              {{ entry.note }}
            </li>
          </ul>
        </section>
      </div>
    </Container>
  </MineDescentExperience>
</template>
