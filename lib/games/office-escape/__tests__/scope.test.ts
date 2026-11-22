import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getGameBySlug } from "@/lib/catalog/catalog";

/** 範圍與資產的檢查（A、H、L、Q 組）：讀原始碼與檔案，不跑遊戲 */
const root = process.cwd();
const walk = (dir: string): string[] =>
  readdirSync(join(root, dir)).flatMap((name) => {
    const path = join(dir, name);
    if (name === "__tests__") return [];
    return statSync(join(root, path)).isDirectory() ? walk(path) : [path];
  });
const read = (file: string) => readFileSync(join(root, file), "utf8");
const gameFiles = [...walk("lib/games/office-escape"), ...walk("app/games/office-escape"), ...walk("app/components/office-escape")].filter((file) => /\.(ts|vue)$/.test(file));
const NO_COMMENT = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("A3 A4 沒做「這次不做」的項目、沒有月台殘留", () => {
  it("程式裡沒有震動、月台、捷運、列車、今日挑戰、稱號", () => {
    for (const file of gameFiles) {
      // 角色庫是設計稿的程式，註解與舊名稱不算；其他檔案的註解可以提到這些詞（例如「不做震動」）
      const code = NO_COMMENT(read(file));
      expect(code, file).not.toMatch(/vibrate|navigator\.vibrate/i);
      expect(code, file).not.toMatch(/月台|捷運|列車/);
    }
  });
});

describe("Q2 純邏輯不依賴 three.js、Phaser、DOM", () => {
  it("lib/games/office-escape 只在 sync／儲存相關檔案用到 window（瀏覽器端模組），沒有引用 three 或 phaser", () => {
    for (const file of walk("lib/games/office-escape").filter((f) => f.endsWith(".ts"))) {
      const code = NO_COMMENT(read(file));
      expect(code, file).not.toMatch(/from "(three|phaser)"/);
      expect(code, file).not.toMatch(/\bdocument\./);
    }
    // 模擬、計分、路線、自動駕駛、session 完全不碰瀏覽器 API
    for (const name of ["sim", "scoring", "route", "autopilot", "session", "config", "share-code", "account-records", "leaderboard"]) {
      expect(NO_COMMENT(read(`lib/games/office-escape/${name}.ts`)), name).not.toMatch(/\bwindow\b|localStorage/);
    }
  });
});

describe("H1 H3 美術資產", () => {
  const dir = "public/games/office-escape/0.1.0";
  it("遊戲引用的圖檔都在專案內、是 WebP；資料夾裡沒有停用的素材", () => {
    const manifest = getGameBySlug("office-escape")!;
    for (const file of [manifest.cover, manifest.hero]) expect(existsSync(join(root, "public", file)), file).toBe(true);
    const sources = gameFiles.map(read).join("\n");
    const referenced = [...sources.matchAll(/(bg-[a-z]+\.webp|hero\.webp|cover\.webp)/g)].map((match) => match[1]);
    for (const name of new Set(referenced)) expect(existsSync(join(root, dir, name)), name).toBe(true);
    const files = readdirSync(join(root, dir)).filter((name) => !["sfx", "music"].includes(name));
    expect(files.sort()).toEqual(["bg-corridor.webp", "bg-elevator.webp", "bg-lobby.webp", "bg-office.webp", "cover.webp", "hero.webp"]);
    for (const name of files) expect(name).toMatch(/\.webp$/);
    // 沒有任何地方引用月台背景、結局插圖、2D 角色圖
    expect(sources).not.toMatch(/bg-platform\.webp|key-visual|end-(ontime|overtime|hidden)\.webp|(runner|npc)-[a-z-]+\.png/);
  });
  it("H8 進遊戲首次載入的背景圖合計不超過 700 KB", () => {
    const size = ["bg-office.webp", "bg-corridor.webp", "bg-elevator.webp", "bg-lobby.webp"].reduce((sum, name) => sum + statSync(join(root, dir, name)).size, 0);
    expect(size).toBeLessThan(700 * 1024);
  });
  it("M13 音檔（交檔後）：音效合計不超過 600 KB、背景音樂不超過 1 MB；還沒交檔時略過", () => {
    const sfx = join(root, dir, "sfx");
    const music = join(root, dir, "music/bgm.mp3");
    if (existsSync(sfx)) expect(readdirSync(sfx).reduce((sum, name) => sum + statSync(join(sfx, name)).size, 0)).toBeLessThan(600 * 1024);
    if (existsSync(music)) expect(statSync(music).size).toBeLessThan(1024 * 1024);
  });
});

describe("L4 資料庫", () => {
  it("新增的 migration 只建一張 office_escape_bests（含索引），沒有累計次數表、沒有同步批次表，也不改精準停車的表", () => {
    const sql = read("migrations/0005_add_office_escape_bests.sql");
    expect([...sql.matchAll(/CREATE TABLE "(\w+)"/g)].map((match) => match[1])).toEqual(["office_escape_bests"]);
    expect(sql).toContain('PRIMARY KEY ("player_id", "mode", "date_key")');
    expect(sql).toContain("ON DELETE CASCADE");
    expect(sql).not.toMatch(/precise_stop|ALTER TABLE|CREATE TRIGGER/);
    expect(sql).toContain('CREATE INDEX "office_escape_bests_mode_date_key_score_idx"');
  });
});

describe("Q4 沒有使用其他遊戲的名稱、角色、美術或用語", () => {
  it("原始碼與文字表沒有常見跑酷遊戲的名稱", () => {
    const text = [...gameFiles.map(read), read("lib/i18n/dictionaries/zh-TW.ts"), read("lib/i18n/dictionaries/en.ts")].join("\n");
    expect(text).not.toMatch(/Subway Surfers|Temple Run|Crossy Road|WarioWare|Frogger|神廟逃亡|地鐵跑酷/i);
  });
});
