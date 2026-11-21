<script setup lang="ts">
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";

type Result = "ok" | "error";

/**
 * 從 Google 回來後，頁首下方出現的提示條（網址上的 ?login=ok／error）。
 * 參數讀到後馬上從網址拿掉，重新整理不會再出現。
 * 成功 5 秒後自己收起；失敗要按關閉才會消失。
 */
defineProps<{ locale: Locale; labels: Dictionary["account"] }>();
const result = ref<Result | null>(null);
const me = useMe();
let timer = 0;

const route = useRoute();
const router = useRouter();

/*
 * 用路由的 query 判斷，不直接讀 window.location：預先產生的頁面接手時，
 * Nuxt 會先用產生時的網址（沒有 ?login=）接手、再換回實際網址，掛載當下讀網址會讀不到。
 * 只在瀏覽器端處理，伺服器產生的畫面不顯示提示條。
 */
onMounted(() =>
  watch(
    () => route.query.login,
    (value) => {
      if (value !== "ok" && value !== "error") return;
      result.value = value;
      const { login: _, ...query } = route.query;
      void router.replace({ query, hash: route.hash });
    },
    { immediate: true },
  ),
);

watch(result, (value) => {
  window.clearTimeout(timer);
  if (value === "ok") timer = window.setTimeout(() => (result.value = null), 5000);
});
onBeforeUnmount(() => window.clearTimeout(timer));
</script>

<template>
  <Container v-if="result" class="pt-4">
    <Banner v-if="result === 'ok'" tone="ok" closable :close-label="labels.close" @close="result = null">
      <strong>{{ labels.loginOk }}</strong><template v-if="me.status === 'loggedIn'">{{ labels.sep }}{{ labels.nickLabel }} <NickName :nick="me.nick" :locale="locale" /></template>
    </Banner>
    <Banner v-else tone="error" closable :close-label="labels.close" @close="result = null">
      <strong>{{ labels.loginError }}</strong>{{ labels.loginErrorRest }}
      <template #action>
        <LoginLink
          class="press flex min-h-11 shrink-0 items-center rounded-full bg-express px-3.5 text-[15px] font-bold text-white hover:bg-express-deep"
        >
          {{ labels.retry }}
        </LoginLink>
      </template>
    </Banner>
  </Container>
</template>
