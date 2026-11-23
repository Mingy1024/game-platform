import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { zhTW } from "../../i18n/dictionaries/zh-TW";
import { getActiveCategories, getGameBySlug, getPublishedGames } from "../catalog";

describe("A1 A2 目錄：精準停車、下班逃離辦公室與一路向下", () => {
  it("三款，slug 是 mine-descent、office-escape、precise-stop，分類都是反應、休閒", () => {
    const games = getPublishedGames();
    expect(games.map((game) => game.slug).sort()).toEqual(["mine-descent", "office-escape", "precise-stop"]);
    for (const game of games) expect(game.categories).toEqual(["reflex", "casual"]);
    expect(getActiveCategories().map((category) => category.slug)).toEqual(["reflex", "casual"]);
  });

  it("舊的三款都不在目錄裡", () => {
    for (const slug of ["tap-targets", "lane-dodge", "memory-pairs"]) expect(getGameBySlug(slug)).toBeUndefined();
  });

  it("封面與主視覺檔案存在且是 WebP", () => {
    for (const slug of ["precise-stop", "office-escape", "mine-descent"]) {
      const { cover, hero } = getGameBySlug(slug)!;
      for (const file of [cover, hero]) {
        expect(file).toMatch(/\.webp$/);
        expect(existsSync(join(process.cwd(), "public", file))).toBe(true);
      }
    }
  });

  it("有玩法說明和常見問題", () => {
    expect(zhTW.preciseStop.howTo.steps).toHaveLength(3);
    expect(zhTW.preciseStop.faq.items.length).toBeGreaterThanOrEqual(3);
    expect(zhTW.officeEscape.howTo.steps).toHaveLength(3);
    expect(zhTW.officeEscape.faq.items.length).toBeGreaterThanOrEqual(3);
    expect(zhTW.mineDescent.howTo.steps).toHaveLength(3);
    expect(zhTW.mineDescent.faq.items.length).toBeGreaterThanOrEqual(3);
  });
});
