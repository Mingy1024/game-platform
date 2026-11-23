import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getGameBySlug } from "@/lib/catalog/catalog";
import { platformSvg, poseSvg, POSES, backgroundSvg, wallsSvg, ceilingSvg } from "../../../../app/games/mine-descent/art";

/** 範圍與資產的檢查（A、H、L、Q 組）：讀原始碼與檔案，不跑遊戲 */
const root = process.cwd();
const walk = (dir: string): string[] =>
  readdirSync(join(root, dir)).flatMap((name) => {
    const path = join(dir, name);
    if (name === "__tests__") return [];
    return statSync(join(root, path)).isDirectory() ? walk(path) : [path];
  });
const read = (file: string) => readFileSync(join(root, file), "utf8");
const gameFiles = [...walk("lib/games/mine-descent"), ...walk("app/games/mine-descent"), ...walk("app/components/mine-descent")].filter((file) => /\.(ts|vue)$/.test(file));
const NO_COMMENT = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("A3 沒做「這次不做」的項目", () => {
  it("程式裡沒有震動、今日礦坑（每日種子）、稱號、通關模式", () => {
    for (const file of gameFiles) {
      const code = NO_COMMENT(read(file));
      expect(code, file).not.toMatch(/vibrate|navigator\.vibrate/i);
      expect(code, file).not.toMatch(/taiwanDateKey|dailySeed|title:\s*"稱號"|通關/);
    }
  });
});

describe("Q2 純邏輯不依賴 Phaser、DOM", () => {
  it("lib/games/mine-descent 沒有引用 phaser 或 document；模擬、計分、關卡、自動駕駛、session 不碰瀏覽器 API", () => {
    for (const file of walk("lib/games/mine-descent").filter((f) => f.endsWith(".ts"))) {
      const code = NO_COMMENT(read(file));
      expect(code, file).not.toMatch(/from "(three|phaser)"/);
      expect(code, file).not.toMatch(/\bdocument\./);
    }
    for (const name of ["sim", "course", "autopilot", "session", "config", "share-code", "account-records", "leaderboard", "sound-mix"]) {
      expect(NO_COMMENT(read(`lib/games/mine-descent/${name}.ts`)), name).not.toMatch(/\bwindow\b|localStorage|Math\.random\(\)(?!.*random)/);
    }
  });
});

describe("H 美術資產", () => {
  const dir = "public/games/mine-descent/0.1.0";
  it("H1 封面與主視覺在專案內、是 WebP；成績圖背景是 JPEG", () => {
    const manifest = getGameBySlug("mine-descent")!;
    for (const file of [manifest.cover, manifest.hero]) {
      expect(file).toMatch(/\.webp$/);
      expect(existsSync(join(root, "public", file)), file).toBe(true);
    }
    expect(existsSync(join(root, "public/share-card/mine-hero.jpg"))).toBe(true);
  });
  it("H2 遊戲內的美術都是程式產生的 SVG：地鼠 10 個姿勢、5 段背景與岩壁、崩塌線、6 種岩板", () => {
    expect(POSES).toHaveLength(10);
    for (const pose of POSES) expect(poseSvg(pose)).toMatch(/^<svg[\s\S]*<\/svg>$/);
    for (const zone of [0, 1, 2, 3, 4]) {
      expect(backgroundSvg(zone)).toContain("<svg");
      expect(wallsSvg(zone)).toContain("<svg");
    }
    expect(ceilingSvg()).toContain("<svg");
    for (const kind of ["rock", "spike", "crack", "cart", "wood", "crystal", "crystalSpent"] as const) expect(platformSvg(kind, 1.8).svg).toContain("<svg");
    // 沒有 2D 圖檔被遊戲程式引用
    expect(gameFiles.filter((file) => file.startsWith("app/")).map(read).join("\n")).not.toMatch(/\.(png|jpg|jpeg)["']/);
  });
  it("H8 資料夾裡只有封面、主視覺、music 和 sfx；音效合計不超過 600 KB、背景音樂不超過 1 MB", () => {
    expect(readdirSync(join(root, dir)).sort()).toEqual(["cover.webp", "hero.webp", "music", "sfx"]);
    expect(readdirSync(join(root, dir, "music"))).toEqual(["bgm.mp3"]);
    expect(statSync(join(root, dir, "music", "bgm.mp3")).size).toBeLessThan(1024 * 1024);
    const sfx = join(root, dir, "sfx");
    expect(readdirSync(sfx).reduce((sum, name) => sum + statSync(join(sfx, name)).size, 0)).toBeLessThan(600 * 1024);
  });
});

describe("L4 資料庫", () => {
  it("新增的 migration 只建一張 mine_descent_bests（含索引），沒有累計次數表、沒有同步批次表，也不改別款遊戲的表", () => {
    const sql = read("migrations/0006_add_mine_descent_bests.sql");
    expect([...sql.matchAll(/CREATE TABLE "(\w+)"/g)].map((match) => match[1])).toEqual(["mine_descent_bests"]);
    expect(sql).toContain('PRIMARY KEY ("player_id", "mode")');
    expect(sql).toContain("ON DELETE CASCADE");
    expect(sql).not.toMatch(/precise_stop|office_escape|ALTER TABLE|CREATE TRIGGER/);
    expect(sql).toContain('CREATE INDEX "mine_descent_bests_mode_score_idx"');
  });
});

describe("Q4 沒有使用其他遊戲的名稱、角色、美術或用語", () => {
  it("原始碼與文字表沒有常見下樓梯類遊戲的名稱", () => {
    const text = [...gameFiles.map(read), read("lib/i18n/dictionaries/zh-TW.ts"), read("lib/i18n/dictionaries/en.ts")].join("\n");
    expect(text).not.toMatch(/NS-SHAFT|小朋友下樓梯|Downwell|Rapid Roll|Icy Tower/i);
  });
});
