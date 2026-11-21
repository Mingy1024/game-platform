import type { MaybeRefOrGetter } from "vue";
import { absoluteUrl, type PageMeta } from "@/lib/site-metadata";

type Tag = Record<string, string>;

/** 把一頁的 SEO 資訊（lib/site-metadata.ts 的 PageMeta）放進 <head> */
export function usePageMeta(input: MaybeRefOrGetter<PageMeta>) {
  useHead(() => {
    const meta = toValue(input);
    const og = meta.openGraph;
    const twitter = meta.twitter;
    const tags: (Tag | undefined)[] = [
      meta.description ? { name: "description", content: meta.description } : undefined,
      meta.noindex ? { name: "robots", content: "noindex" } : undefined,
      ...(og
        ? [
            { property: "og:title", content: og.title },
            { property: "og:description", content: og.description },
            { property: "og:url", content: absoluteUrl(og.url) },
            ...og.images.flatMap((image) => [
              { property: "og:image", content: absoluteUrl(image.url) },
              image.width ? { property: "og:image:width", content: String(image.width) } : undefined,
              image.height ? { property: "og:image:height", content: String(image.height) } : undefined,
              image.alt ? { property: "og:image:alt", content: image.alt } : undefined,
            ]),
            { property: "og:type", content: "website" },
          ]
        : []),
      ...(twitter
        ? [
            { name: "twitter:card", content: twitter.card },
            { name: "twitter:title", content: twitter.title },
            ...twitter.images.map((url) => ({ name: "twitter:image", content: absoluteUrl(url) })),
          ]
        : []),
    ];
    const links: (Tag | undefined)[] = [
      meta.canonical ? { rel: "canonical", href: absoluteUrl(meta.canonical) } : undefined,
      ...Object.entries(meta.languages ?? {}).map(([hreflang, path]) => ({
        rel: "alternate",
        hreflang,
        href: absoluteUrl(path),
      })),
    ];
    // unhead 的型別對每種 rel 有不同的必填欄位，這裡的組合都是合法的
    return {
      title: meta.title,
      meta: tags.filter((item) => item !== undefined) as never,
      link: links.filter((item) => item !== undefined) as never,
    };
  });
}
