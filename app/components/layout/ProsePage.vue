<script setup lang="ts">
/** 關於、政策、聯絡等文章頁的共用版型。draft：內容尚未定稿時顯示提示 */
const { draft = false } = defineProps<{ title: string; lead?: string; draft?: boolean }>();
</script>

<template>
  <Container class="py-10 sm:py-14">
    <PageHeading :title="title" :lead="lead" />
    <p v-if="draft" class="mt-6 max-w-2xl rounded-xl border border-edge bg-edge-tint px-4 py-3 text-ink">
      這一頁是暫定內容。網站正式上線前，會依實際使用的服務與聯絡方式改寫。
    </p>
    <div class="prose-page mt-8 max-w-2xl space-y-8"><slot /></div>
  </Container>
</template>
