<script setup lang="ts">
import type { IconName } from "@/lib/icons";

/** 我的紀錄頁的三個區塊。內容之後由本機紀錄（localStorage）填入，目前顯示空狀態 */
const panels: { id: string; icon: IconName; title: string; body: string }[] = [
  { id: "recent", icon: "clock", title: "最近玩過", body: "還沒有玩過的遊戲。玩過之後，最近的 20 款會列在這裡。" },
  { id: "favorites", icon: "heart", title: "收藏", body: "還沒有收藏。在遊戲頁按下收藏，之後就能從這裡快速找到。" },
  { id: "bests", icon: "restart", title: "最佳紀錄", body: "還沒有紀錄。完成一局之後，每款遊戲的最佳成績會留在這裡。" },
];
</script>

<template>
  <div class="mt-10 grid gap-5 lg:grid-cols-3">
    <section v-for="panel in panels" :key="panel.id" :aria-labelledby="`${panel.id}-title`" class="rounded-2xl border border-line bg-card p-5">
      <h2 :id="`${panel.id}-title`" class="flex items-center gap-2 text-xl font-extrabold text-ink">
        <Icon :name="panel.icon" :size="24" class="text-sign" />
        {{ panel.title }}
      </h2>
      <p class="mt-3 text-muted">{{ panel.body }}</p>
    </section>
  </div>
</template>
