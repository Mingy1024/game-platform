<script setup lang="ts">
import type { Category } from "@/lib/catalog/categories";
import type { GameManifest } from "@/lib/catalog/schema";

type Sort = "newest" | "title";

/**
 * 完整目錄的搜尋、分類與排序。
 * 目前在瀏覽器端篩選；把條件同步到網址 query（供分享）留待後續。
 */
const { games } = defineProps<{ games: GameManifest[]; categories: Category[] }>();

const keyword = ref("");
const category = ref<string | null>(null);
const sort = ref<Sort>("newest");
const searchId = useId();
const sortId = useId();

const results = computed(() => {
  const term = keyword.value.trim().toLowerCase();
  const filtered = games.filter((game) => {
    if (category.value && !game.categories.includes(category.value)) return false;
    if (!term) return true;
    return [game.title, game.summary, ...game.tags].join(" ").toLowerCase().includes(term);
  });
  if (sort.value === "title") return [...filtered].sort((a, b) => a.title.localeCompare(b.title, "zh-Hant"));
  return filtered;
});

const filtering = computed(() => keyword.value.trim() !== "" || category.value !== null);

function clearFilters() {
  keyword.value = "";
  category.value = null;
}

const chip = (selected: boolean) =>
  `min-h-11 cursor-pointer rounded-full px-4 font-semibold transition-colors ${
    selected ? "bg-edge text-ink" : "bg-platform text-sign ring-1 ring-inset ring-line hover:bg-sign-tint"
  }`;
</script>

<template>
  <div>
    <div class="flex flex-col gap-4 rounded-2xl border border-line bg-card p-4 sm:p-5">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div class="flex-1">
          <label :for="searchId" class="mb-1 block font-semibold text-ink">搜尋遊戲</label>
          <div class="relative">
            <Icon name="search" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              :id="searchId"
              v-model="keyword"
              type="search"
              placeholder="輸入遊戲名稱或玩法"
              autocomplete="off"
              class="h-12 w-full rounded-xl border border-line bg-platform pl-10 pr-3 text-ink placeholder:text-muted"
            >
          </div>
        </div>
        <div>
          <label :for="sortId" class="mb-1 block font-semibold text-ink">排序</label>
          <select
            :id="sortId"
            v-model="sort"
            class="h-12 w-full cursor-pointer rounded-xl border border-line bg-platform px-3 text-ink sm:w-40"
          >
            <option value="newest">最新上線</option>
            <option value="title">名稱</option>
          </select>
        </div>
      </div>

      <fieldset>
        <legend class="mb-1 font-semibold text-ink">分類</legend>
        <div class="flex flex-wrap gap-2">
          <button type="button" :aria-pressed="category === null" :class="chip(category === null)" @click="category = null">
            全部
          </button>
          <button
            v-for="item in categories"
            :key="item.slug"
            type="button"
            :aria-pressed="category === item.slug"
            :class="chip(category === item.slug)"
            @click="category = item.slug"
          >
            {{ item.name }}
          </button>
        </div>
      </fieldset>
    </div>

    <p class="mb-4 mt-6 text-muted" role="status">
      {{ filtering ? `符合條件的遊戲共 ${results.length} 款` : `共 ${results.length} 款遊戲` }}
    </p>

    <GameGrid v-if="results.length > 0" :games="results" heading-level="h2" />
    <div v-else class="rounded-2xl border border-dashed border-line bg-card px-5 py-10 text-center">
      <p class="text-lg font-bold text-ink">找不到符合的遊戲</p>
      <p class="mt-1 text-muted">換個關鍵字，或清除篩選條件看全部遊戲。</p>
      <button
        type="button"
        class="press mt-5 min-h-11 cursor-pointer rounded-full bg-card px-5 font-bold text-sign ring-2 ring-inset ring-sign hover:bg-sign-tint"
        @click="clearFilters"
      >
        清除篩選條件
      </button>
    </div>
  </div>
</template>
