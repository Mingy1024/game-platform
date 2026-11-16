import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { zhTW } from "../../i18n/dictionaries/zh-TW";
import { getActiveCategories, getGameBySlug, getPublishedGames } from "../catalog";

describe("A2 目錄只有精準停車", () => {
  it("只有一款，slug 是 precise-stop，分類是反應、休閒", () => {
    const games = getPublishedGames();
    expect(games.map((game) => game.slug)).toEqual(["precise-stop"]);
    expect(games[0].categories).toEqual(["reflex", "casual"]);
    expect(getActiveCategories().map((category) => category.slug)).toEqual(["reflex", "casual"]);
  });

  it("舊的三款都不在目錄裡", () => {
    for (const slug of ["tap-targets", "lane-dodge", "memory-pairs"]) expect(getGameBySlug(slug)).toBeUndefined();
  });

  it("封面檔案存在且是 WebP", () => {
    const cover = getGameBySlug("precise-stop")!.cover;
    expect(cover).toMatch(/\.webp$/);
    expect(existsSync(join(process.cwd(), "public", cover))).toBe(true);
  });

  it("有玩法說明和常見問題", () => {
    expect(zhTW.preciseStop.howTo.steps).toHaveLength(3);
    expect(zhTW.preciseStop.faq.items.length).toBeGreaterThanOrEqual(3);
  });
});
