import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getGameBySlug } from "@/lib/catalog/catalog";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { LOCALES } from "@/lib/i18n/locales";
import { QUALITY } from "../config";
import { AUDIO_READY, SOUND_BASE, SOUND_FILES } from "../sound-mix";

/** 範圍與資產的檢查（A、H、Q 組）：讀原始碼與檔案，不跑遊戲 */
const root = process.cwd();
const walk = (dir: string): string[] =>
  readdirSync(join(root, dir)).flatMap((name) => {
    const path = join(dir, name);
    if (name === "__tests__") return [];
    return statSync(join(root, path)).isDirectory() ? walk(path) : [path];
  });
const read = (file: string) => readFileSync(join(root, file), "utf8");
const NO_COMMENT = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/^\s*\/\/.*$/gm, "");
const libFiles = walk("lib/games/monk-soup-tower").filter((f) => f.endsWith(".ts"));
const gameFiles = [...libFiles, ...walk("app/games/monk-soup-tower"), ...walk("app/components/monk-soup-tower")].filter((f) => /\.(ts|vue)$/.test(f));

describe("A3 沒做「這次不做」的項目", () => {
  it("沒有震動、手動轉視角（OrbitControls）、天氣、會動的障礙、托盤疊碗、玩家自製關卡、碼錶", () => {
    for (const file of gameFiles) {
      const code = NO_COMMENT(read(file));
      expect(code, file).not.toMatch(/vibrate|OrbitControls|TrackballControls|weather|stopwatch|editor/i);
      expect(code, file).not.toMatch(/taiwanDateKey|dailySeed/);
    }
  });
});

describe("Q2 Q3 純邏輯放在 lib、不依賴 three.js 與 DOM", () => {
  it("lib/games/monk-soup-tower 沒有引用 three 或 document；模擬、計分、關卡、session 不碰瀏覽器 API", () => {
    for (const file of libFiles) {
      const code = NO_COMMENT(read(file));
      expect(code, file).not.toMatch(/from "three"/);
      expect(code, file).not.toMatch(/\bdocument\./);
    }
    for (const name of ["sim", "layouts", "path", "scoring", "session", "camera", "solver", "tower", "config", "share-code", "account-records", "leaderboard", "sound-mix"]) {
      expect(NO_COMMENT(read(`lib/games/monk-soup-tower/${name}.ts`)), name).not.toMatch(/\bwindow\b|localStorage|Math\.random\(\)/);
    }
  });
  it("Q3 畫面與伺服器不自己算分數、灑湯、摔落", () => {
    for (const file of [...walk("app/components/monk-soup-tower"), ...walk("server/api/games/monk-soup-tower"), "server/utils/monk-soup-tower-records.ts"]) {
      const code = NO_COMMENT(read(file));
      expect(code, file).not.toMatch(/tempFactor|thetaMax|spillPerRad|\* 0\.3 \*/);
    }
  });
});

describe("Q4 沒有使用參考作品的名稱與用語", () => {
  it("程式與七種語言的文字沒有ひと筆鉄骨わたり、鋼骨、工人、GOAL、ALT、STAGE", () => {
    const banned = /ひと筆鉄骨|鉄骨|鋼骨|鋼梁|工人|\bGOAL\b|\bALT\b|\bSTAGE\b/;
    for (const file of gameFiles) expect(NO_COMMENT(read(file)), file).not.toMatch(banned);
    for (const locale of LOCALES) expect(JSON.stringify(dictionaries[locale].monkSoupTower), locale).not.toMatch(banned);
  });
});

describe("H 美術資產與 3D", () => {
  it("H1 封面與主視覺是 WebP、成績圖背景是 JPEG，都在專案內", () => {
    const manifest = getGameBySlug("monk-soup-tower")!;
    for (const file of [manifest.cover, manifest.hero]) {
      expect(file).toMatch(/^\/games\/monk-soup-tower\/.+\.webp$/);
      expect(existsSync(join(root, "public", file)), file).toBe(true);
    }
    expect(existsSync(join(root, "public/share-card/monk-hero.jpg"))).toBe(true);
  });
  it("H2 3D 模型全部程式建模：不載入模型檔與貼圖", () => {
    for (const file of [...walk("app/games/monk-soup-tower"), ...walk("app/components/monk-soup-tower")]) {
      const code = NO_COMMENT(read(file));
      expect(code, file).not.toMatch(/GLTFLoader|OBJLoader|FBXLoader|TextureLoader|\.glb|\.gltf|\.obj"/);
    }
    expect(walk("public/games/monk-soup-tower").filter((f) => /\.(glb|gltf|obj|fbx|png)$/.test(f))).toEqual([]);
  });
  it("H4 畫質：MeshStandardMaterial、一盞平行光、陰影貼圖 1024、FogExp2", () => {
    const scene = read("app/games/monk-soup-tower/scene.ts");
    const model = read("app/games/monk-soup-tower/tower-model.ts");
    expect(model).toContain("MeshStandardMaterial");
    expect(scene.match(/new THREE\.DirectionalLight/g)).toHaveLength(1);
    expect(scene).toContain("new THREE.FogExp2");
    expect(scene).toContain("sun.shadow.mapSize.set(QUALITY.shadowMapSize, QUALITY.shadowMapSize)");
    expect(QUALITY.shadowMapSize).toBe(1024);
  });
  it("H5 解析度倍率上限 1.5；連續 2 秒低於 40 fps 時關陰影、倍率降到 1", () => {
    expect([QUALITY.maxPixelRatio, QUALITY.lowFps, QUALITY.lowFpsSeconds]).toEqual([1.5, 40, 2]);
    const scene = read("app/games/monk-soup-tower/scene.ts");
    expect(scene).toContain("Math.min(window.devicePixelRatio || 1, QUALITY.maxPixelRatio)");
    expect(scene).toMatch(/renderer\.shadowMap\.enabled = false;[\s\S]*renderer\.setPixelRatio\(1\)/);
  });
  it("H8 three.js 只在遊戲畫面載入；音效合計 ≤ 600 KB、背景音樂 ≤ 750 KB（有交檔時）", () => {
    for (const file of ["app/components/monk-soup-tower/MonkSoupTowerPage.vue", "app/components/monk-soup-tower/MonkBoard.vue", "app/components/monk-soup-tower/MonkSoupTowerExperience.vue"]) {
      expect(read(file), file).not.toMatch(/from "three"|games\/monk-soup-tower\/scene/);
    }
    expect(read("app/components/monk-soup-tower/MonkSoupTowerExperience.vue")).toContain('import("./game/MonkStage.vue")');
    const dir = join(root, "public", SOUND_BASE);
    if (AUDIO_READY) {
      const total = SOUND_FILES.reduce((sum, file) => sum + statSync(join(dir, file)).size, 0);
      expect(total).toBeLessThanOrEqual(600 * 1024);
      expect(statSync(join(root, "public/games/monk-soup-tower/0.1.0/music/bgm.mp3")).size).toBeLessThanOrEqual(750 * 1024);
    } else {
      // 還沒交檔：不放任何音檔，也不送請求（sound.ts 看 AUDIO_READY）
      expect(read("app/games/monk-soup-tower/sound.ts")).toContain("!AUDIO_READY");
    }
  });
});
