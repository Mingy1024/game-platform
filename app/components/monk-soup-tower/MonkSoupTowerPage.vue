<script setup lang="ts">
import { getCategoriesOfGame, getGameBySlug } from "@/lib/catalog/catalog";
import { localizeCategory } from "@/lib/catalog/localize";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localePath, type Locale } from "@/lib/i18n/locales";

const HERO = "/games/monk-soup-tower/0.1.0/hero.webp";
const card = "rounded-[18px] border border-line bg-card p-5";
const cardTitle = "text-xl font-extrabold text-ink";

/**
 * 和尚端湯上塔的介紹頁（I1）。區塊順序：主視覺 → 出發區（固定關卡／隨機模式＋我的最佳）→ 我的紀錄（旁邊是全站排行分頁）
 * → 怎麼玩 → 廣告版位（唯一一個，I2）→ 判定與計分 → 常見問題。按下出發後整頁換成遊戲畫面（網址不變）。
 * banner 插槽：從朋友的成績連結進來時，顯示對方分數的那一行（和「挑戰同一座塔」）。
 */
const { locale } = defineProps<{ locale: Locale }>();
const dict = getDictionary(locale);
const text = dict.monkSoupTower;
const game = getGameBySlug("monk-soup-tower");
const categories = game ? getCategoriesOfGame(game).map((category) => localizeCategory(category, dict)) : [];
const keys = text.howTo.keys;
const keyChips = [
  [keys.draw, keys.drawValue],
  [keys.walk, keys.walkValue],
  [keys.redraw, "R"],
  [keys.pause, "Esc"],
];
const bands = [
  ["hot", "70℃ ↑"],
  ["veryWarm", "60–70℃"],
  ["warm", "50–60℃"],
  ["cold", "50℃ ↓"],
] as const;

// 主視覺在第一屏：優先下載
useHead({ link: [{ rel: "preload", as: "image", href: HERO, fetchpriority: "high" }] });
/** 日文標題沒有空格又長，手機縮一級字才放得進一行（韓文斷行由全站的 :lang(ko) 處理） */
const longTitle = !text.title.includes(" ") && [...text.title].length > 10;
</script>

<template>
  <MonkSoupTowerExperience :locale="locale">
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
        <h1 :class="`${longTitle ? 'text-xl' : 'text-2xl'} font-extrabold text-sign sm:text-3xl`">{{ text.title }}</h1>
        <p class="basis-full text-muted lg:basis-auto lg:text-lg">{{ text.lead }}</p>
        <ul class="flex flex-wrap items-center gap-2 lg:ml-auto">
          <li v-for="category in categories" :key="category.slug">
            <NuxtLink :to="`/categories/${category.slug}`" class="flex min-h-11 items-center rounded-full bg-sign-tint px-4 font-semibold text-sign hover:bg-edge-tint">
              {{ category.name }}
            </NuxtLink>
          </li>
          <li class="empty:hidden"><PlayCount slug="monk-soup-tower" :locale="locale" /></li>
        </ul>
      </header>

      <slot name="banner" />

      <div class="mt-4 flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-6">
        <div class="relative aspect-[4/5] w-full max-w-[460px] shrink-0 self-center overflow-hidden rounded-[18px] bg-[#cfe2dd] lg:aspect-auto lg:min-h-[560px] lg:w-[420px] lg:max-w-none lg:self-auto">
          <img :src="HERO" :alt="text.heroAlt" fetchpriority="high" class="absolute inset-0 size-full object-cover" data-testid="hero">
          <span class="absolute bottom-3.5 left-3.5 rounded-full bg-[#23302d]/80 px-3 py-1 text-sm font-bold text-white">{{ text.chip }}</span>
        </div>
        <div class="flex min-w-0 flex-1 flex-col gap-4">
          <MonkBoard />
          <MonkRecordsCard />
        </div>
      </div>

      <section aria-labelledby="howto-title" :class="`mt-7 ${card}`" data-testid="howto">
        <h2 id="howto-title" :class="cardTitle">{{ text.howTo.title }}</h2>
        <ol class="mt-4 grid gap-4 md:grid-cols-3 md:gap-6">
          <li v-for="(step, index) in text.howTo.steps" :key="step.title" class="flex gap-3">
            <span aria-hidden="true" :class="`flex size-8 shrink-0 items-center justify-center rounded-full font-black text-white ${index === 2 ? 'bg-[#a8372c]' : 'bg-sign'}`">{{ index + 1 }}</span>
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
        <section aria-labelledby="scoring-title" :class="card" data-testid="scoring">
          <h2 id="scoring-title" :class="cardTitle">{{ text.scoring.title }}</h2>
          <table class="mt-3 w-full">
            <tbody>
              <tr v-for="row in text.scoring.rows" :key="row.label" class="border-b border-line">
                <th scope="row" class="py-2 pr-3 text-left align-top font-extrabold text-sign">{{ row.label }}</th>
                <td class="py-2 text-muted">{{ row.value }}</td>
              </tr>
            </tbody>
          </table>
          <h3 class="mt-4 text-sm font-extrabold text-ink">{{ text.scoring.bandsTitle }}</h3>
          <ul class="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <li v-for="[band, range] in bands" :key="band" class="flex flex-col rounded-xl bg-platform px-3 py-2">
              <span class="font-extrabold" :class="band === 'cold' ? 'text-[#345c8c]' : 'text-[#a8372c]'">{{ text.bands[band] }}</span>
              <span class="text-sm tabular-nums text-muted">{{ range }}</span>
            </li>
          </ul>
          <p class="mt-3 text-sm text-muted">{{ text.scoring.note }}</p>
        </section>

        <section aria-labelledby="faq-title" :class="card" data-testid="faq">
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
  </MonkSoupTowerExperience>
</template>
