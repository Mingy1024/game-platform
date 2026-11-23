import { describe, expect, it } from "vitest";
import { gameMetadata, sharedMetadata } from "@/lib/games/precise-stop/meta";
import { resolveTwitter, robotsTxt } from "@/lib/site-metadata";

describe("K4 社群預覽的 Twitter 卡片", () => {
  it("遊戲頁沒有指定時從 Open Graph 補齊（大圖卡片、標題、描述、圖片）", () => {
    const meta = gameMetadata("zh-TW", "precise-stop");
    expect(resolveTwitter(meta)).toEqual({
      card: "summary_large_image",
      title: meta.openGraph!.title,
      description: meta.openGraph!.description,
      images: ["/games/precise-stop/0.1.0/hero.webp"],
    });
  });

  it("沒有圖片時用一般卡片；沒有 Open Graph 時不輸出", () => {
    expect(resolveTwitter({ openGraph: { title: "T", description: "D", url: "/", images: [] } })?.card).toBe("summary");
    expect(resolveTwitter({ title: "T" })).toBeUndefined();
  });

  it("成績頁保留自己的卡片和成績圖，描述沿用 Open Graph", () => {
    const code = "AQMBRAAAAAAAAQB4AAAC_tQABQMDhAAABAnEAAzM";
    const meta = sharedMetadata("en", "precise-stop", code);
    const twitter = resolveTwitter(meta)!;
    expect(twitter.card).toBe("summary_large_image");
    expect(twitter.images).toEqual([`/en/games/precise-stop/r/${code}/card`]);
    expect(twitter.description).toBe(meta.openGraph!.description);
  });
});

describe("測試站 noindex", () => {
  it("robots.txt：測試站禁止全部爬取，正式站全部允許", () => {
    expect(robotsTxt(true)).toBe("User-agent: *\nDisallow: /\n");
    expect(robotsTxt(false)).toBe("User-agent: *\nAllow: /\n");
  });
});
