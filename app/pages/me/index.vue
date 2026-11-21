<script setup lang="ts">
import { FLAGS } from "@/lib/flags";
import { t } from "@/lib/i18n/zh-TW";

usePageMeta({ title: "我的紀錄", description: "這台裝置上最近玩過的遊戲、收藏與最佳紀錄。", noindex: true });
</script>

<template>
  <Container class="py-10 sm:py-14">
    <PageHeading title="我的紀錄" lead="最近玩過的遊戲、收藏和最佳紀錄都在這裡。" />

    <!-- 登入開關打開時，「只存在這台裝置」的提示併進帳號卡（MeAccount.vue） -->
    <MeAccount v-if="FLAGS.login" :labels="t.account">
      <RecordPanels />
    </MeAccount>
    <template v-else>
      <p class="mt-6 flex max-w-2xl gap-3 rounded-xl border border-edge bg-edge-tint px-4 py-3 text-ink">
        <Icon name="device" :size="24" class="mt-0.5 shrink-0" />
        <span>這些紀錄只存在這台裝置的瀏覽器裡，不會同步到其他裝置。清除瀏覽器資料後會消失。</span>
      </p>
      <RecordPanels />
    </template>

    <div class="mt-10">
      <ButtonLink href="/games">{{ t.actions.allGames }}</ButtonLink>
    </div>
  </Container>
</template>
