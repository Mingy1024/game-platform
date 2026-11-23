<script setup lang="ts">
import type { GameText } from "~/games/mine-descent/shared";
import type { RunResult } from "@/lib/games/mine-descent/session";
import { encodeRun, toSharedRun } from "@/lib/games/mine-descent/share-code";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fmt, formatNumber } from "@/lib/i18n/format";
import { localePath, type Locale } from "@/lib/i18n/locales";

type Card = { status: "loading" } | { status: "ready"; url: string; file: File } | { status: "error" };

/**
 * 分享成績。成績圖由伺服器依成績代碼產生（和社群預覽圖是同一張），
 * 手機優先用系統分享選單帶出圖片、文字和連結；電腦提供各平台的分享按鈕。
 * 分享面板的按鈕文字（分享到、下載、複製連結…）和精準停車共用同一組翻譯（base）。
 */
const props = defineProps<{
  text: GameText;
  base: Dictionary["preciseStop"];
  locale: Locale;
  result: RunResult;
  newScore: boolean;
  newDepth: boolean;
}>();
const emit = defineEmits<{ close: [] }>();

const card = shallowRef<Card>({ status: "loading" });
const attempt = ref(0);
const copied = ref(false);
const wide = useMediaQuery("(min-width: 768px)");
const canShareFiles = ref(false);
const closeButton = useTemplateRef<HTMLButtonElement>("close");

const path = computed(() => {
  const code = encodeRun(
    toSharedRun({ depth: props.result.depth, parts: props.result.parts, newScore: props.newScore, newDepth: props.newDepth }),
  );
  return localePath(props.locale, `/games/mine-descent/r/${code}`);
});

const shareText = computed(() =>
  fmt(props.text.share.text, { depth: formatNumber(props.result.depth, props.locale), score: formatNumber(props.result.total, props.locale) }),
);

function onKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.stopPropagation();
    emit("close");
  }
}
onMounted(() => {
  closeButton.value?.focus();
  window.addEventListener("keydown", onKeyDown, true);
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKeyDown, true));

// 換了成績或按了重試，在新的圖回來之前都算載入中
watch(
  [path, attempt],
  ([target], _, onCleanup) => {
    let cancelled = false;
    let objectUrl: string | null = null;
    card.value = { status: "loading" };
    onCleanup(() => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    });
    fetch(`${target}/card`)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const file = new File([blob], "mine-descent.png", { type: "image/png" });
        objectUrl = URL.createObjectURL(blob);
        card.value = { status: "ready", url: objectUrl, file };
        try {
          canShareFiles.value =
            typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
        } catch {
          canShareFiles.value = false;
        }
      })
      .catch(() => {
        if (!cancelled) card.value = { status: "error" };
      });
  },
  { immediate: true },
);

const absoluteUrl = () => new URL(path.value, window.location.origin).toString();

async function shareNative() {
  const current = card.value;
  if (current.status !== "ready") return;
  try {
    await navigator.share({ files: [current.file], text: shareText.value, url: absoluteUrl() });
  } catch {
    // 使用者取消分享不算錯誤
  }
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(absoluteUrl());
    copied.value = true;
    window.setTimeout(() => (copied.value = false), 2000);
  } catch {
    copied.value = false;
  }
}

function openShare(target: "line" | "facebook" | "x") {
  const url = encodeURIComponent(absoluteUrl());
  const message = encodeURIComponent(shareText.value);
  const href = {
    line: `https://social-plugins.line.me/lineit/share?url=${url}&text=${message}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    x: `https://twitter.com/intent/tweet?text=${message}&url=${url}`,
  }[target];
  window.open(href, "_blank", "noopener,noreferrer,width=640,height=640");
}

const showSocial = computed(() => wide.value || !canShareFiles.value);
const outline =
  "flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-2xl border-2 border-line px-2 text-center text-[15px] leading-tight font-bold text-ink disabled:cursor-not-allowed disabled:opacity-50";
const social = "flex min-h-13 cursor-pointer items-center gap-3 rounded-2xl px-4 text-left text-lg font-extrabold text-white";
</script>

<template>
  <div class="absolute inset-0 z-10 flex items-end justify-center md:items-center" data-no-brake>
    <div class="absolute inset-0 bg-canvas/75" aria-hidden="true" @click="emit('close')" />
    <div
      role="dialog"
      aria-modal="true"
      :aria-label="base.share.title"
      data-testid="share-panel"
      class="ps-sheet relative flex max-h-full w-full flex-col gap-3 overflow-auto rounded-t-3xl bg-card px-5 pb-5 pt-2 text-ink md:w-[780px] md:max-w-[calc(100vw-3rem)] md:flex-row md:gap-7 md:rounded-3xl md:p-7"
    >
      <div class="flex items-center justify-between md:hidden">
        <h2 class="text-xl font-extrabold text-sign">{{ base.share.title }}</h2>
        <button
          type="button"
          :aria-label="base.share.close"
          class="flex size-11 cursor-pointer items-center justify-center rounded-full text-muted"
          @click="emit('close')"
        >
          <Icon name="close" :size="22" />
        </button>
      </div>

      <div
        class="mx-auto aspect-[4/5] w-[min(56vw,216px)] shrink-0 overflow-hidden rounded-2xl bg-canvas shadow-[0_6px_16px_rgb(16_19_26/0.25)] md:mx-0 md:w-[330px]"
      >
        <!-- 成績圖是即時產生的，不另外轉檔 -->
        <img
          v-if="card.status === 'ready'"
          :src="card.url"
          :alt="fmt(text.share.cardAlt, { depth: formatNumber(result.depth, locale), score: formatNumber(result.total, locale) })"
          class="size-full object-cover"
          data-testid="share-card"
        >
        <div v-else-if="card.status === 'loading'" class="flex size-full flex-col items-center justify-center gap-2 text-white" role="status">
          <span class="ps-spinner size-8 rounded-full border-4 border-white/20 border-t-edge" />
          <span class="px-3 text-center text-sm">{{ base.share.preparing }}</span>
        </div>
        <div v-else class="flex size-full flex-col items-center justify-center gap-3 p-3 text-center text-white" role="alert">
          <span class="text-sm">{{ base.share.failed }}</span>
          <button type="button" class="min-h-11 cursor-pointer rounded-full bg-express px-5 font-bold" @click="attempt++">
            {{ base.stage.retry }}
          </button>
        </div>
      </div>

      <div class="flex min-w-0 flex-1 flex-col gap-2.5">
        <div class="hidden items-center justify-between md:flex">
          <h2 class="text-2xl font-extrabold text-sign">{{ base.share.title }}</h2>
          <button
            ref="close"
            type="button"
            class="min-h-11 cursor-pointer rounded-lg border border-line px-3 text-sm text-muted"
            @click="emit('close')"
          >
            {{ base.share.escClose }}
          </button>
        </div>

        <button
          v-if="canShareFiles"
          type="button"
          :disabled="card.status !== 'ready'"
          data-testid="share-native"
          class="press flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-express text-lg font-extrabold text-white shadow-[0_4px_0_var(--express-deep)] disabled:opacity-50"
          @click="shareNative"
        >
          <Icon name="share" :size="20" />
          {{ base.share.shareTo }}
        </button>

        <template v-if="showSocial">
          <button type="button" :class="`${social} bg-signal`" data-testid="share-line" @click="openShare('line')">
            <span class="flex size-8 items-center justify-center rounded-lg bg-white/20 text-[11px]">LINE</span>
            {{ base.share.line }}
          </button>
          <button type="button" :class="`${social} bg-sign`" data-testid="share-facebook" @click="openShare('facebook')">
            <span class="flex size-8 items-center justify-center rounded-lg bg-white/20 text-sm">f</span>
            {{ base.share.facebook }}
          </button>
          <button type="button" :class="`${social} bg-ink`" data-testid="share-x" @click="openShare('x')">
            <span class="flex size-8 items-center justify-center rounded-lg bg-white/20 text-sm">X</span>
            {{ base.share.x }}
          </button>
        </template>

        <div class="flex gap-2.5">
          <a v-if="card.status === 'ready'" :href="card.url" download="mine-descent.png" :class="outline" data-testid="share-download">
            <Icon name="download" :size="18" />
            {{ wide ? base.share.download : base.share.save }}
          </a>
          <button v-else type="button" disabled :class="outline">
            <Icon name="download" :size="18" />
            {{ wide ? base.share.download : base.share.save }}
          </button>
          <button type="button" :class="outline" data-testid="share-copy" @click="copyLink">
            <Icon :name="copied ? 'check' : 'link'" :size="18" />
            <span aria-live="polite">{{ copied ? base.share.copied : base.share.copy }}</span>
          </button>
        </div>

        <p v-if="showSocial" class="mt-auto rounded-xl bg-edge-tint px-3 py-2.5 text-sm leading-relaxed">{{ base.share.instagramNote }}</p>
      </div>
    </div>
  </div>
</template>
