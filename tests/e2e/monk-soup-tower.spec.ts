import { expect, hydratedPage, randomIp, test, type Browser, type BrowserContext, type Page } from "./fixtures";

/**
 * 和尚端湯上塔（驗收清單 docs/acceptance/monk-soup-tower.md）。
 * 遊戲掛勾（只在開發版）：window.__monkSoupTower = { session（MonkSession）, scene（stats、project）, sound, idealLine }。
 */
const GAME = "/games/monk-soup-tower";
const ORIGIN = "http://localhost:3000";
const RECORDS = "/api/games/monk-soup-tower/records";
const LB = "/api/games/monk-soup-tower/leaderboard";
const LOCAL = "game-station:monk-soup-tower:v1";

type Vec2 = { x: number; z: number };
type Result = { mode: string; seed: number | null; outcome: string; floor: number; soup: number; timeMs: number; temp: number; score: number | null; grade: string | null };
type Hook = {
  session: {
    autopilot: boolean;
    timeScale: number;
    phase: string;
    floor: number;
    holding: boolean;
    timeMs: number;
    soup: number;
    path: unknown;
    tower: { seed: number | null; floors: { id: string; flipped: boolean; start: Vec2; goal: Vec2 }[] };
    layout: { start: Vec2; goal: Vec2 };
    sim: { s: number; lat: number; lon: number; v: number } | null;
    result: Result | null;
    setLine(points: Vec2[]): string;
    setHolding(value: boolean): void;
    snapshot(): { phase: string; result: Result | null };
  };
  scene: {
    stats: { calls: number; triangles: number; shadows: boolean; pixelRatio: number; drops: number; maxDrops: number; decals: number };
    project(point: Vec2): { x: number; y: number };
  };
  sound: { log: { name: string }[]; state: Record<string, unknown> };
  idealLine(layout: unknown): Vec2[] | null;
};
declare global {
  interface Window {
    __monkSoupTower: Hook;
  }
}

const unique = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const phase = (page: Page) => page.evaluate(() => window.__monkSoupTower.session.phase);

function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (!["error", "warning"].includes(message.type())) return;
    const text = message.text();
    if (text.includes("GL Driver Message") || text.includes("GPU stall due to ReadPixels")) return;
    problems.push(`${message.type()}: ${text}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${String(error)}`));
  return problems;
}

/** 進遊戲畫面，等到可以畫線 */
async function enter(page: Page, mode: "fixed" | "random" = "fixed", path = GAME) {
  await page.goto(path);
  await page.getByTestId(`depart-${mode}`).click();
  await expect(page.getByTestId("hud")).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => phase(page), { timeout: 20_000 }).toBe("draw");
}

/** 自動駕駛玩完一局（送達塔頂），停在結算 */
async function playToFinal(page: Page, scale = 10) {
  await page.evaluate((s) => {
    const session = window.__monkSoupTower.session;
    session.autopilot = true;
    session.timeScale = s;
  }, scale);
  await expect(page.getByTestId("final-panel")).toBeVisible({ timeout: 120_000 });
}

/** 畫一條會走出外緣的線（終點仍在樓梯口），按住走到摔下去 */
async function fallOff(page: Page) {
  await page.evaluate(() => {
    const s = window.__monkSoupTower.session;
    const start = s.layout.start;
    const out = Array.from({ length: 20 }, (_, i) => ({ x: start.x, z: start.z + (i * 2.5) / 19 }));
    s.setLine([...out, s.layout.goal]);
    s.setHolding(true);
  });
}

/** 開成績連結：開發伺服器第一次編譯這個路由時，Vite 可能重新載入頁面打斷導覽（ERR_ABORTED），重試一次 */
async function openLink(page: Page, link: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(link, { timeout: 25_000 });
      return;
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
}

/** 世界座標 → 畫面座標 */
const screen = (page: Page, point: Vec2) => page.evaluate((p) => window.__monkSoupTower.scene.project(p), point);

/** 用滑鼠照標準畫法畫線 */
async function drawWithMouse(page: Page, points?: Vec2[]) {
  const line = points ?? (await page.evaluate(() => window.__monkSoupTower.idealLine(window.__monkSoupTower.session.layout)!));
  const first = await screen(page, line[0]!);
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (const p of line.slice(1)) {
    const q = await screen(page, p);
    await page.mouse.move(q.x, q.y, { steps: 2 });
  }
  await page.mouse.up();
}

test.describe("目錄、介紹頁與整頁切換", () => {
  test("A1 A2 I1 I2 首頁主打、全部遊戲、益智與休閒分類找得到；介紹頁區塊齊全、只有一個廣告版位", async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto("/");
    await expect(page.locator(`a[href="${GAME}"]`).first()).toBeAttached();
    for (const path of ["/games", "/categories/puzzle", "/categories/casual"]) {
      await page.goto(path);
      await expect(page.locator(`a[href="${GAME}"]`).first(), path).toBeAttached();
    }
    await page.goto(GAME);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("和尚端湯上塔");
    await expect(page.getByTestId("hero")).toBeVisible();
    await expect(page.getByTestId("depart-fixed")).toBeVisible();
    await expect(page.getByTestId("depart-random")).toBeVisible();
    await expect(page.getByTestId("records-card")).toBeVisible();
    for (const id of ["howto", "scoring", "faq"]) await expect(page.getByTestId(id)).toBeVisible();
    // 廣告在「怎麼玩」和「判定與計分」之間
    const order = await page.evaluate(() => {
      const top = (sel: string) => document.querySelector(sel)!.getBoundingClientRect().top;
      const ads = document.querySelectorAll("[data-ad-slot], [data-slot-id]");
      return { ads: ads.length, howto: top("[data-testid=howto]"), ad: ads[0] ? ads[0].getBoundingClientRect().top : -1, scoring: top("[data-testid=scoring]") };
    });
    expect(order.ads).toBe(1);
    expect(order.ad).toBeGreaterThan(order.howto);
    expect(order.ad).toBeLessThan(order.scoring);
    await expect(page.getByTestId("game-stage")).toHaveCount(0);
    expect(problems).toEqual([]);
  });

  test("I3 I4 I5 I6 只有出發鈕能開始；整頁切換、網址不變；返回鍵、暫停選單、結算都回介紹頁；重新整理回介紹；遊戲畫面沒有選單與廣告", async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto(GAME);
    await page.getByTestId("hero").click();
    await expect(page.getByTestId("game-stage")).toHaveCount(0);
    await enter(page);
    await expect(page).toHaveURL(GAME);
    await expect(page.locator("header").first()).toBeHidden();
    await expect(page.getByTestId("game-stage").locator("[data-ad-slot], [data-slot-id]")).toHaveCount(0);
    await page.goBack();
    await expect(page.getByTestId("departure-board")).toBeVisible();
    await expect(page.getByTestId("game-stage")).toHaveCount(0);
    await enter(page);
    await page.reload();
    await expect(page.getByTestId("departure-board")).toBeVisible();
    await expect(page.getByTestId("game-stage")).toHaveCount(0);
    await enter(page);
    await page.keyboard.press("Escape");
    await page.getByTestId("pause-back").click();
    await expect(page.getByTestId("departure-board")).toBeVisible();
    await enter(page);
    await playToFinal(page);
    await page.getByTestId("back-to-intro-button").click();
    await expect(page.getByTestId("departure-board")).toBeVisible();
    expect(problems).toEqual([]);
  });

  test("N5 M3 介紹頁不載入 three.js 與音檔，按出發才載入場景與 13 個音效、背景音樂", async ({ page }) => {
    const urls: string[] = [];
    page.on("request", (request) => urls.push(request.url()));
    await page.goto(GAME);
    await page.waitForTimeout(800);
    expect(urls.filter((url) => /three|MonkStage|monk-soup-tower\/scene|sfx\/|music\//.test(url))).toEqual([]);
    await enter(page);
    expect(urls.some((url) => /monk-soup-tower\/scene|three/.test(url))).toBe(true);
    await expect.poll(() => urls.filter((url) => /monk-soup-tower\/0\.1\.0\/(sfx|music)\//.test(url)).length, { timeout: 15_000 }).toBe(14);
    await expect.poll(() => page.evaluate(() => (window.__monkSoupTower.sound.state as { loaded: number; failed: number; musicLoaded: boolean })), { timeout: 20_000 }).toMatchObject({ loaded: 13, failed: 0, musicLoaded: true });
  });
});

test.describe("畫線與操作", () => {
  test("E2 B1 B2 F3 滑鼠：不在和尚腳下按不會開始畫；沒畫到樓梯口清掉線；從腳下畫到金色圓圈就畫好，線不變色、沒有預告", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "滑鼠操作只在電腦測");
    await enter(page);
    const layout = await page.evaluate(() => window.__monkSoupTower.session.layout);
    // 離和尚很遠的地方按下：不開始畫，提示從和尚腳下開始
    const far = await screen(page, { x: layout.start.x + 3, z: layout.start.z });
    await page.mouse.click(far.x, far.y);
    await expect(page.getByTestId("draw-toast")).toHaveText("從和尚腳下開始畫");
    expect(await page.evaluate(() => window.__monkSoupTower.session.path)).toBeNull();
    // 只畫一半：清掉線，提示還沒畫到樓梯口
    const line = await page.evaluate(() => window.__monkSoupTower.idealLine(window.__monkSoupTower.session.layout)!);
    await drawWithMouse(page, line.slice(0, Math.floor(line.length / 2)));
    await expect(page.getByTestId("draw-toast")).toHaveText("還沒畫到樓梯口");
    expect(await phase(page)).toBe("draw");
    // 完整的線
    await drawWithMouse(page, line);
    await expect.poll(() => phase(page)).toBe("ready");
    await expect(page.getByTestId("redraw-button")).toBeVisible();
    await expect(page.getByTestId("hold-button")).toBeVisible();
  });

  test("E1 E5 手機：手指從和尚腳下往下 56 px 按住拖曳也能畫（筆尖在手指上方）；畫線時頁面不捲動、不選字", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "觸控只在手機測");
    await enter(page);
    const line = await page.evaluate(() => window.__monkSoupTower.idealLine(window.__monkSoupTower.session.layout)!);
    const frame = page.getByTestId("game-frame");
    const style = await frame.evaluate((el) => {
      const s = getComputedStyle(el);
      return { touch: s.touchAction, select: s.userSelect || (s as unknown as Record<string, string>).webkitUserSelect };
    });
    expect(style.touch).toBe("none");
    expect(style.select).toBe("none");
    const points = await Promise.all(line.map((p) => screen(page, p)));
    await frame.evaluate(
      (el, pts) => {
        const fire = (type: string, p: { x: number; y: number }) =>
          el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, pointerType: "touch", isPrimary: true, clientX: p.x, clientY: p.y + 56, button: 0 }));
        fire("pointerdown", pts[0]!);
        for (const p of pts.slice(1)) fire("pointermove", p);
        fire("pointerup", pts[pts.length - 1]!);
      },
      points,
    );
    await expect.poll(() => phase(page)).toBe("ready");
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("E3 E4 B4 空白鍵按住走、放開停；走之前 R 能重畫、開始走之後不能；Esc 暫停與繼續", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "鍵盤只在電腦測");
    await enter(page);
    await page.evaluate(() => {
      const s = window.__monkSoupTower.session;
      s.setLine(window.__monkSoupTower.idealLine(s.layout)!);
    });
    await page.keyboard.press("r");
    expect(await phase(page)).toBe("draw");
    await page.evaluate(() => {
      const s = window.__monkSoupTower.session;
      s.setLine(window.__monkSoupTower.idealLine(s.layout)!);
    });
    await page.keyboard.down(" ");
    await expect.poll(() => phase(page)).toBe("walk");
    await page.waitForTimeout(500);
    await page.keyboard.up(" ");
    expect(await page.evaluate(() => window.__monkSoupTower.session.holding)).toBe(false);
    await expect.poll(() => page.evaluate(() => window.__monkSoupTower.session.sim!.v), { timeout: 3000 }).toBe(0);
    await page.keyboard.press("r");
    expect(await phase(page)).toBe("walk");
    await expect(page.getByTestId("redraw-button")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("pause-dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("pause-dialog")).toHaveCount(0);
    expect(await phase(page)).toBe("walk");
  });

  test("E3 畫面任何地方按住都能走（滑鼠左鍵或手指），放開就停", async ({ page }) => {
    await enter(page);
    await page.evaluate(() => {
      const s = window.__monkSoupTower.session;
      s.setLine(window.__monkSoupTower.idealLine(s.layout)!);
    });
    const box = (await page.getByTestId("game-frame").boundingBox())!;
    await page.getByTestId("game-frame").evaluate((el, b) => {
      el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 3, pointerType: "touch", isPrimary: true, clientX: b.x + b.width / 2, clientY: b.y + b.height * 0.4, button: 0 }));
    }, box);
    await expect.poll(() => phase(page)).toBe("walk");
    expect(await page.evaluate(() => window.__monkSoupTower.session.holding)).toBe(true);
    await page.getByTestId("game-frame").evaluate((el) => el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 3, pointerType: "touch" })));
    expect(await page.evaluate(() => window.__monkSoupTower.session.holding)).toBe(false);
  });

  test("E6 切到背景分頁、視窗失焦時自動暫停", async ({ page }) => {
    await enter(page);
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(page.getByTestId("pause-dialog")).toBeVisible();
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.getByTestId("resume-button").click();
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect(page.getByTestId("pause-dialog")).toBeVisible();
  });
});

test.describe("流程、畫面與結算", () => {
  test("F1 F2 G1 B15 一局：層數牌、畫線、按住走、過層 … 送達塔頂結算；畫面只有層數、聲音鈕、暫停、湯量、溫度，沒有碼錶；主控台沒有錯誤", async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto(GAME);
    await page.getByTestId("depart-fixed").click();
    await expect(page.getByTestId("floor-card")).toHaveAttribute("data-floor", "1", { timeout: 60_000 });
    await expect(page.getByTestId("floor-card")).toContainText("第一層");
    await expect(page.getByTestId("hud")).toBeVisible();
    for (const id of ["hud-floor", "music-button", "mute-button", "pause-button", "hud-soup", "hud-temp"]) await expect(page.getByTestId(id), id).toBeVisible();
    await expect(page.getByTestId("hud-floor")).toHaveAttribute("aria-label", "第 1 層，共 5 層");
    expect(await page.getByTestId("hud").textContent()).not.toMatch(/秒|:\d\d/);
    const floors: number[] = [];
    await page.exposeFunction("__floor", (n: number) => floors.push(n));
    await page.evaluate(() => {
      const s = window.__monkSoupTower.session;
      let last = s.floor;
      const tick = () => {
        if (s.floor !== last) {
          last = s.floor;
          (window as unknown as { __floor(n: number): void }).__floor(last);
        }
        if (s.phase !== "over") requestAnimationFrame(tick);
      };
      tick();
    });
    await playToFinal(page, 8);
    expect(floors).toEqual([2, 3, 4, 5]);
    const panel = page.getByTestId("final-panel");
    await expect(panel).toHaveAttribute("data-outcome", "summit");
    // G4：分數跑動的 1.2 秒內評級還沒出現
    await expect(page.getByTestId("final-grade")).toHaveAttribute("data-shown", "false");
    await expect(page.getByTestId("final-grade")).toHaveAttribute("data-shown", "true", { timeout: 5000 });
    await expect(page.getByTestId("final-mode")).toHaveText("固定關卡");
    await expect(page.getByTestId("final-grade")).toHaveText(/^[SABC]$/);
    for (const id of ["final-score", "final-soup", "final-temp", "final-band", "final-time", "record-note", "share-button", "again-button", "back-to-intro-button"]) {
      await expect(page.getByTestId(id), id).toBeVisible();
    }
    const result = (await page.evaluate(() => window.__monkSoupTower.session.result))!;
    await expect(page.getByTestId("final-score")).toHaveAttribute("data-score", String(result.score));
    expect(problems).toEqual([]);
  });

  test("F9 G3 B13 踩空：慢動作 0.6 秒後才出現結算；顯示「踩空了」、到第幾層、湯量、時間，沒有分數與分享", async ({ page }) => {
    await enter(page);
    // 每一格記下階段切換的時間（頁面裡量，不受測試輪詢的間隔影響）
    await page.evaluate(() => {
      const w = window as unknown as { __times: Record<string, number> };
      w.__times = {};
      const tick = () => {
        const p = window.__monkSoupTower.session.phase;
        w.__times[p] ??= performance.now();
        if (p !== "over") requestAnimationFrame(tick);
      };
      tick();
    });
    await fallOff(page);
    await expect(page.getByTestId("final-panel")).toBeVisible({ timeout: 10_000 });
    const times = await page.evaluate(() => (window as unknown as { __times: Record<string, number> }).__times);
    expect(times.over! - times.falling!).toBeGreaterThanOrEqual(550);
    await expect(page.getByTestId("final-panel")).toHaveAttribute("data-outcome", "fall");
    await expect(page.getByTestId("final-reason")).toHaveText("踩空了");
    await expect(page.getByTestId("final-floor")).toHaveText("到第 1 層");
    await expect(page.getByTestId("final-soup")).toBeVisible();
    await expect(page.getByTestId("final-time")).toBeVisible();
    await expect(page.getByTestId("final-score")).toHaveCount(0);
    await expect(page.getByTestId("share-button")).toHaveCount(0);
    await page.getByTestId("again-button").click();
    await expect.poll(() => page.evaluate(() => window.__monkSoupTower.session.floor)).toBe(1);
    await expect(page.getByTestId("final-panel")).toHaveCount(0);
  });

  test("F10 M1 暫停選單有音樂、音效開關（和右上的鈕同步、記在本機）、繼續、從第一層重來、回介紹頁", async ({ page }) => {
    await enter(page);
    await page.getByTestId("mute-button").click();
    await expect(page.getByTestId("mute-button")).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("music-button")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("pause-button").click();
    await expect(page.getByTestId("sound-switch")).toHaveAttribute("aria-checked", "false");
    await expect(page.getByTestId("music-switch")).toHaveAttribute("aria-checked", "true");
    await page.getByTestId("music-switch").click();
    await expect(page.getByTestId("music-switch")).toHaveAttribute("aria-checked", "false");
    for (const id of ["resume-button", "restart-button", "pause-back"]) await expect(page.getByTestId(id)).toBeVisible();
    await page.getByTestId("restart-button").click();
    await expect(page.getByTestId("pause-dialog")).toHaveCount(0);
    await expect(page.getByTestId("music-button")).toHaveAttribute("aria-pressed", "false");
    const prefs = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k]) => /mute|music|sound/i.test(k)))));
    expect(prefs).not.toBe("{}");
  });

  test("G2 G6 灑湯有湯滴、湯量閃一下並飄「−n」；減少動態效果時沒有湯滴與飄字、結算直接出現", async ({ browser }) => {
    for (const reduced of [false, true]) {
      const context = await browser.newContext({ reducedMotion: reduced ? "reduce" : "no-preference", extraHTTPHeaders: { "cf-connecting-ip": randomIp() } });
      const page = await hydratedPage(context);
      await enter(page);
      await page.evaluate(() => {
        const s = window.__monkSoupTower.session;
        s.setLine(window.__monkSoupTower.idealLine(s.layout)!);
        s.setHolding(true);
      });
      await page.waitForTimeout(300);
      // 用力晃：連續幾格把湯面推過門檻
      for (let i = 0; i < 10; i++) {
        await page.evaluate(() => {
          window.__monkSoupTower.session.sim!.lat = 0.9;
        });
        await page.waitForTimeout(60);
      }
      await page.waitForTimeout(500);
      const stats = await page.evaluate(() => window.__monkSoupTower.scene.stats);
      expect(stats.decals, `reduced=${reduced}`).toBeGreaterThan(0);
      if (reduced) {
        expect(stats.maxDrops).toBe(0);
        await expect(page.getByTestId("spill-pop")).toHaveCount(0);
      } else {
        expect(stats.maxDrops).toBeGreaterThan(0);
        expect(stats.maxDrops).toBeLessThanOrEqual(24);
        // 湯量數字閃一下、「−n」往上飄
        await expect(page.getByTestId("spill-pop")).toBeAttached();
        await expect(page.getByTestId("hud-soup")).toHaveClass(/mst-flash/);
      }
      await context.close();
    }
  });

  test("F7 溫度低於 50℃：溫度底色變藍、換成涼掉的圖示", async ({ page }) => {
    await enter(page);
    await expect(page.getByTestId("icon-steam")).toBeVisible();
    await page.evaluate(() => {
      (window.__monkSoupTower.session as unknown as { ticks: number }).ticks = 60 * 101;
    });
    await expect(page.getByTestId("hud-temp")).toHaveAttribute("data-cold", "true");
    await expect(page.getByTestId("icon-cold")).toBeVisible();
  });
});

test.describe("3D 效能", () => {
  test("H5 H6 畫線與走路鏡頭 draw call < 100、三角形 < 5 萬；解析度倍率 ≤ 1.5", async ({ page }) => {
    await enter(page);
    const check = async (label: string) => {
      const stats = await page.evaluate(() => window.__monkSoupTower.scene.stats);
      expect(stats.calls, label).toBeLessThan(100);
      expect(stats.triangles, label).toBeLessThan(50_000);
      expect(stats.pixelRatio, label).toBeLessThanOrEqual(1.5);
    };
    await check("draw");
    for (let floor = 0; floor < 5; floor++) {
      await page.evaluate((k) => {
        const s = window.__monkSoupTower.session as unknown as { index: number; path: null; sim: null; phase: string };
        s.index = k;
        s.path = null;
        s.sim = null;
        s.phase = "draw";
      }, floor);
      await page.waitForTimeout(300);
      await check(`floor ${floor + 1} draw`);
      await page.evaluate(() => {
        const s = window.__monkSoupTower.session;
        s.setLine(window.__monkSoupTower.idealLine(s.layout)!);
        s.setHolding(true);
      });
      await page.waitForTimeout(700);
      await check(`floor ${floor + 1} walk`);
    }
  });

  test("H7 進出遊戲 5 次：每次離開都釋放 WebGL（context 數不累積）", async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __gl: { made: number; lost: number } };
      w.__gl = { made: 0, lost: 0 };
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        const ctx = (original as (...args: unknown[]) => unknown).call(this, type, ...rest);
        if (ctx && /webgl/.test(type) && !(this as unknown as { __counted?: boolean }).__counted) {
          (this as unknown as { __counted?: boolean }).__counted = true;
          w.__gl.made += 1;
          this.addEventListener("webglcontextlost", () => (w.__gl.lost += 1));
        }
        return ctx;
      } as typeof original;
    });
    await page.goto(GAME);
    for (let i = 0; i < 5; i++) {
      await page.getByTestId("depart-fixed").click();
      await expect(page.getByTestId("hud")).toBeVisible({ timeout: 60_000 });
      await page.goBack();
      await expect(page.getByTestId("departure-board")).toBeVisible();
    }
    await expect.poll(() => page.evaluate(() => (window as unknown as { __gl: { made: number; lost: number } }).__gl)).toEqual({ made: 5, lost: 5 });
    expect(await page.locator("canvas").count()).toBe(0);
  });
});

test.describe("紀錄與分享", () => {
  test("J1 J4 J5 結算存本機紀錄；分享面板、成績圖 1080×1350；成績連結顯示朋友的成績、預覽圖是成績圖、noindex", async ({ page, context }) => {
    const problems = watchConsole(page);
    await enter(page);
    await playToFinal(page);
    const result = (await page.evaluate(() => window.__monkSoupTower.session.result))!;
    const saved = JSON.parse((await page.evaluate((key) => localStorage.getItem(key), LOCAL))!) as { fixed: { score: number; timeMs: number }; floors: { fixed: number } };
    expect(saved.fixed).toEqual({ score: result.score, timeMs: result.timeMs });
    expect(saved.floors.fixed).toBe(6);

    await page.getByTestId("share-button").click();
    await expect(page.getByTestId("share-panel")).toBeVisible();
    await expect(page.getByTestId("share-card")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("share-copy")).toBeVisible();
    const size = await page.getByTestId("share-card").evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight]);
    expect(size).toEqual([1080, 1350]);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => undefined);
    await page.getByTestId("share-copy").click();
    const link = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
    // 剪貼簿一定要拿到連結：拿不到代表複製壞了，不能跳過後面的成績頁與 SEO 檢查
    expect(link).not.toBe("");
    {
      expect(link).toMatch(/\/games\/monk-soup-tower\/r\/[A-Za-z0-9_-]+$/);
      const friend = await hydratedPage(context);
      await openLink(friend, link);
      await expect(friend.getByTestId("shared-banner")).toContainText(String(result.score));
      await expect(friend.getByTestId("challenge-same")).toHaveCount(0);
      expect(await friend.locator("meta[name=robots]").getAttribute("content")).toContain("noindex");
      const og = await friend.locator("meta[property='og:image']").getAttribute("content");
      const card = await friend.request.get(og!);
      expect(card.status()).toBe(200);
      expect(card.headers()["content-type"]).toBe("image/png");
    }
    expect(problems).toEqual([]);
  });

  test("J6 亂改的成績代碼：介紹頁照常、成績圖 404", async ({ page }) => {
    const response = await page.goto(`${GAME}/r/AAAAAAAAAAAAAAAAAAAAAAA`);
    expect(response?.status()).toBe(200);
    await expect(page.getByTestId("departure-board")).toBeVisible();
    await expect(page.getByTestId("shared-banner")).toHaveCount(0);
    expect((await page.request.get(`${GAME}/r/AAAAAAAAAAAAAAAAAAAAAAA/card`)).status()).toBe(404);
  });

  test("D3 J7 隨機模式：結算顯示塔號；分享連結有「挑戰同一座塔」，用同一個塔號開始", async ({ page, context }, info) => {
    test.skip(info.project.name !== "desktop", "分享連結只在電腦測一次");
    await enter(page, "random");
    const seed = await page.evaluate(() => window.__monkSoupTower.session.tower.seed);
    await playToFinal(page);
    await expect(page.getByTestId("final-mode")).toContainText(`#${String(seed).padStart(6, "0")}`);
    await page.getByTestId("share-button").click();
    await expect(page.getByTestId("share-card")).toBeVisible({ timeout: 60_000 });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByTestId("share-copy").click();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    const friend = await hydratedPage(context);
    await openLink(friend, link);
    await friend.getByTestId("challenge-same").click();
    await expect(friend.getByTestId("hud")).toBeVisible({ timeout: 60_000 });
    expect(await friend.evaluate(() => window.__monkSoupTower.session.tower.seed)).toBe(seed);
  });

  test("J2 瀏覽器不能儲存時照常能玩完一局，結算提示紀錄不會留下", async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new Error("quota");
      };
    });
    await enter(page);
    await playToFinal(page);
    await expect(page.getByTestId("not-saved")).toBeVisible();
  });
});

test.describe("多語系與版面", () => {
  for (const [prefix, title, floor] of [
    ["", "和尚端湯上塔", "第一層"],
    ["/zh-cn", "和尚端汤上塔", "第一层"],
    ["/en", "Monk, Soup, Pagoda", "Floor 1"],
    ["/ja", "お坊さんのスープ塔のぼり", "1 階"],
    ["/ko", "스님의 국 배달 탑 오르기", "1층"],
    ["/vi", "Sư Bưng Canh Lên Tháp", "Tầng 1"],
    ["/pt", "Monge, Sopa e Pagode", "Andar 1"],
  ] as const) {
    test(`K1 K2 K3 K7 ${prefix || "/"} 介紹頁標題、語言標示、層數牌`, async ({ page }, info) => {
      test.skip(info.project.name !== "desktop" && prefix !== "/vi", "各語言在電腦測，手機只測越南文");
      await page.goto(`${prefix}${GAME}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      const lang = await page.locator("html").getAttribute("lang");
      expect(lang?.toLowerCase().startsWith(prefix ? prefix.slice(1).slice(0, 2) : "zh")).toBe(true);
      expect(await page.locator("link[rel=canonical]").getAttribute("href")).toContain(`${prefix}${GAME}`);
      expect(await page.locator("link[rel=alternate][hreflang]").count()).toBeGreaterThanOrEqual(7);
      await page.getByTestId("depart-fixed").click();
      await expect(page.getByTestId("floor-card")).toContainText(floor, { timeout: 60_000 });
    });
  }

  test("K2 語言選單切換後留在同一頁", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "電腦測");
    await page.goto(GAME);
    await page.getByRole("button", { name: /語言|Language/ }).first().click();
    await page.getByRole("link", { name: "English" }).click();
    await expect(page).toHaveURL(/\/en\/games\/monk-soup-tower$/);
  });

  for (const width of [360, 390, 1280, 1920]) {
    test(`N1 ${width}px 介紹頁與遊戲畫面沒有橫向捲軸`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/vi" + GAME);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.getByTestId("depart-fixed").click();
      await expect(page.getByTestId("hud")).toBeVisible({ timeout: 60_000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }

  for (const [width, height] of [
    [360, 780],
    [1280, 720],
  ] as const) {
    test(`K6 N2 越南文與葡文 ${width} px：介紹頁標題、層數牌、暫停選單、結算沒有溢出，按鈕在遊戲框內且至少 44 px`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      for (const prefix of ["/vi", "/pt"]) {
        await page.goto(`${prefix}${GAME}`);
        expect(await page.getByRole("heading", { level: 1 }).evaluate((el) => el.scrollWidth <= el.clientWidth + 1 && el.getBoundingClientRect().right <= window.innerWidth), `${prefix} h1`).toBe(true);
        await enter(page, "fixed", `${prefix}${GAME}`);
        const problems = (ids: string[], minSize = false) =>
          page.evaluate(
            ([list, min]) => {
              const frame = document.querySelector("[data-testid=game-frame]")!.getBoundingClientRect();
              return (list as string[]).filter((id) => {
                const el = document.querySelector(`[data-testid=${id}]`);
                if (!el) return true;
                const rect = el.getBoundingClientRect();
                const inside = rect.bottom <= frame.bottom + 1 && rect.right <= frame.right + 1 && rect.left >= frame.left - 1 && rect.top >= frame.top - 1;
                const small = min && (rect.width < 44 || rect.height < 44);
                return !inside || el.scrollWidth > el.clientWidth + 1 || small;
              });
            },
            [ids, minSize] as const,
          );
        await page.keyboard.press("Escape");
        expect(await problems(["pause-status"]), `${prefix} pause text`).toEqual([]);
        expect(await problems(["resume-button", "restart-button", "pause-back"], true), `${prefix} pause buttons`).toEqual([]);
        // 從第一層重來會再出現層數牌
        await page.getByTestId("restart-button").click();
        await expect(page.getByTestId("floor-card")).toBeVisible();
        expect(await problems(["floor-card"]), `${prefix} floor card`).toEqual([]);
        await expect.poll(() => phase(page), { timeout: 20_000 }).toBe("draw");
        await page.evaluate(() => {
          const s = window.__monkSoupTower.session;
          s.setLine(window.__monkSoupTower.idealLine(s.layout)!);
        });
        expect(await problems(["redraw-button", "hold-button", "pause-button", "mute-button", "music-button"], true), `${prefix} hud`).toEqual([]);
        await playToFinal(page);
        expect(await problems(["final-mode", "final-temp", "final-time"]), `${prefix} final text`).toEqual([]);
        expect(await problems(["share-button", "again-button", "back-to-intro-button"], true), `${prefix} final buttons`).toEqual([]);
      }
    });
  }

  test("N2 N3 遊戲畫面的按鈕至少 44×44，圖示鈕有無障礙名稱", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await enter(page);
    await page.evaluate(() => {
      const s = window.__monkSoupTower.session;
      s.setLine(window.__monkSoupTower.idealLine(s.layout)!);
    });
    for (const id of ["pause-button", "mute-button", "music-button", "redraw-button", "hold-button"]) {
      const element = page.getByTestId(id);
      const box = (await element.boundingBox())!;
      expect(box.width, id).toBeGreaterThanOrEqual(44);
      expect(box.height, id).toBeGreaterThanOrEqual(44);
      if (["pause-button", "mute-button", "music-button"].includes(id)) expect(await element.getAttribute("aria-label"), id).toBeTruthy();
    }
  });

  test("L2 累計遊玩次數未滿 100 次不顯示", async ({ page }) => {
    await page.route("**/api/play-count/monk-soup-tower", (route) => (route.request().method() === "GET" ? route.fulfill({ json: { count: 99 } }) : route.continue()));
    await page.goto(GAME);
    await page.waitForTimeout(500);
    await expect(page.getByTestId("play-count")).toHaveCount(0);
  });
});

// ---- 帳號、訪客與排行榜 ----
const newBrowser = (browser: Browser, headers: Record<string, string> = {}) =>
  browser.newContext({ extraHTTPHeaders: { "cf-connecting-ip": randomIp(), ...headers } });
const best = (score: number, timeMs = 60_000, mode: "fixed" | "random" = "fixed", at = Date.now() - 1000) => ({ mode, score, timeMs, achievedAt: at });
type Body = { fixed?: { score: number; timeMs: number } | null; random?: unknown; guest?: { playerId: string }; error?: string } | null;

async function postAsNew(context: BrowserContext | Page, bests: ReturnType<typeof best>[], extra: Record<string, unknown> = {}) {
  const syncId = `id-${unique()}`;
  const response = await context.request.post(`${RECORDS}/sync`, { headers: { Origin: ORIGIN }, data: { syncId, playerId: null, bests, ...extra } });
  return { response, syncId, body: (await response.json().catch(() => null)) as Body };
}
const mine = async (context: BrowserContext, player: string) =>
  (await context.request.get(`${LB}/me?scope=fixed&player=${player}`)).json() as Promise<{ rank: number | null; score: number | null; timeMs: number | null; total: number }>;

test.describe("帳號紀錄與排行榜 API", () => {
  test("T1 T2 T4 P4 建立訪客上榜；取最佳（同分比時間）；一張固定關卡榜、每人一列、不帶個人資料；名次不快取", async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop", "API 只測一次");
    const [a, b] = await Promise.all([newBrowser(browser), newBrowser(browser)]);
    const first = await postAsNew(a, [best(800, 50_000), best(990, 9000, "random")]);
    expect(first.response.status()).toBe(200);
    expect(first.body).toMatchObject({ fixed: { score: 800, timeMs: 50_000 }, random: { score: 990, timeMs: 9000 } });
    const guestA = first.body!.guest!.playerId;
    const sync = (context: BrowserContext, bests: ReturnType<typeof best>[], playerId: string) =>
      context.request.post(`${RECORDS}/sync`, { headers: { Origin: ORIGIN }, data: { syncId: `id-${unique()}`, playerId, bests } });
    expect(((await (await sync(a, [best(700, 1000)], guestA)).json()) as Body)!.fixed).toEqual({ score: 800, timeMs: 50_000 });
    expect(((await (await sync(a, [best(800, 40_000)], guestA)).json()) as Body)!.fixed).toEqual({ score: 800, timeMs: 40_000 });
    // 同一批重送：結果不變（冪等）
    expect(((await (await sync(a, [best(800, 40_000)], guestA)).json()) as Body)!.fixed).toEqual({ score: 800, timeMs: 40_000 });

    const second = await postAsNew(b, [best(800, 45_000)]);
    const guestB = second.body!.guest!.playerId;
    const [ra, rb] = [await mine(a, guestA), await mine(b, guestB)];
    expect(ra.rank! < rb.rank!).toBe(true);
    const top = await (await a.request.get(`${LB}?scope=fixed`)).json();
    expect(Object.keys(top.rows[0]).sort()).toEqual(["achievedAt", "color", "guest", "nick", "rank", "score", "timeMs"]);
    expect(JSON.stringify(top)).not.toContain(guestA);
    expect(top.rows.filter((row: { score: number; timeMs: number }) => row.score === 990 && row.timeMs === 9000)).toHaveLength(0);
    expect((await a.request.get(`${LB}?scope=random`)).status()).toBe(400);
    expect((await a.request.get(`${LB}/me?scope=fixed&player=${guestA}`)).headers()["cache-control"]).toContain("no-store");
    await Promise.all([a.close(), b.close()]);
  });

  test("P3 P5 P6 沒有身分 401；格式或範圍不對 400 且不寫入；身分不同 409；跨站 403；超過 8 KB 被拒", async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop", "API 只測一次");
    const context = await newBrowser(browser);
    expect((await context.request.get(RECORDS)).status()).toBe(401);
    for (const bad of [best(1001), best(500, 999), best(500, 30 * 60_000 + 1), { ...best(5), mode: "daily" as never }, { ...best(5), extra: 1 } as never]) {
      expect((await postAsNew(context, [bad])).response.status(), JSON.stringify(bad)).toBe(400);
    }
    expect((await context.cookies()).find((c) => c.name === "gs_guest")).toBeUndefined();
    const ok = await postAsNew(context, [best(50)]);
    const id = ok.body!.guest!.playerId;
    expect((await context.request.get(`${RECORDS}?player=${id}`)).status()).toBe(200);
    expect((await context.request.get(`${RECORDS}?player=someone-else`)).status()).toBe(409);
    const mismatch = await context.request.post(`${RECORDS}/sync`, { headers: { Origin: ORIGIN }, data: { syncId: `id-${unique()}`, playerId: "someone-else", bests: [best(1)] } });
    expect(mismatch.status()).toBe(409);
    const cross = await context.request.post(`${RECORDS}/sync`, { headers: { Origin: "https://evil.example" }, data: { syncId: `id-${unique()}`, playerId: id, bests: [best(1)] } });
    expect(cross.status()).toBe(403);
    // 合法的同步內容加上 JSON 空白：8 KB 以內照常收下，超過才回 413（分辨大小限制和格式錯誤）
    const padded = (size: number) => {
      const body = JSON.stringify({ syncId: `id-${unique()}`, playerId: id, bests: [best(51)] });
      return body.slice(0, -1) + " ".repeat(size - body.length) + "}";
    };
    const within = await context.request.post(`${RECORDS}/sync`, { headers: { Origin: ORIGIN, "content-type": "application/json" }, data: padded(8000) });
    expect(within.status()).toBe(200);
    const huge = await context.request.post(`${RECORDS}/sync`, { headers: { Origin: ORIGIN, "content-type": "application/json" }, data: padded(9000) });
    expect(huge.status()).toBe(413);
    await context.close();
  });

  test("T8 回應掉了、用同一個 syncId 重送：找回同一個訪客", async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop", "API 只測一次");
    const context = await newBrowser(browser);
    const first = await postAsNew(context, [best(900)]);
    await context.clearCookies();
    const again = await context.request.post(`${RECORDS}/sync`, { headers: { Origin: ORIGIN }, data: { syncId: first.syncId, playerId: null, bests: [best(900)] } });
    expect(((await again.json()) as Body)!.guest!.playerId).toBe(first.body!.guest!.playerId);
    await context.close();
  });

  test("T9 同一個 IP 每分鐘最多建立 3 個訪客，第 4 個回 429", async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop", "API 只測一次");
    const ip = randomIp();
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      const context = await browser.newContext({ extraHTTPHeaders: { "cf-connecting-ip": ip } });
      statuses.push((await postAsNew(context, [best(10)])).response.status());
      await context.close();
    }
    expect(statuses).toEqual([200, 200, 200, 429]);
  });

  test("T10 歐盟地區：沒帶同意回 403 consent_required，帶了才建立訪客", async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop", "API 只測一次");
    const context = await newBrowser(browser, { "cf-ipcountry": "FR" });
    const refused = await postAsNew(context, [best(10)]);
    expect(refused.response.status()).toBe(403);
    expect(refused.body?.error).toBe("consent_required");
    expect((await postAsNew(context, [best(10)], { consent: true })).response.status()).toBe(200);
    await context.close();
  });
});

test.describe("玩完一局：訪客上榜", () => {
  test("P11 T3 T7 只看介紹頁不呼叫紀錄 API；摔下去不送；送達塔頂才送出、建立訪客，回介紹頁後榜上看得到自己", async ({ page, context }) => {
    const calls: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes(RECORDS)) calls.push(request.method());
    });
    await page.goto(GAME);
    await page.waitForTimeout(800);
    expect(calls).toEqual([]);
    await enter(page);
    await fallOff(page);
    await expect(page.getByTestId("final-panel")).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1000);
    expect(calls).toEqual([]);
    await page.getByTestId("again-button").click();
    await expect.poll(() => phase(page), { timeout: 10_000 }).toMatch(/intro|draw/);
    await playToFinal(page);
    await expect.poll(async () => (await context.cookies()).find((c) => c.name === "gs_guest") !== undefined, { timeout: 15_000 }).toBe(true);
    expect(calls).toContain("POST");
    // 前端真的採用了建立訪客的回應：還在結算頁、沒有重新讀登入狀態，待送的成績就已經清掉（Codex 審查第 3 輪）
    await expect
      .poll(() =>
        page.evaluate(() => {
          const pending = JSON.parse(localStorage.getItem("game-station:monk-soup-tower:pending:v1") ?? "{}") as { bests?: unknown[] };
          const inbox = Object.keys(localStorage).filter((k) => k.startsWith("game-station:monk-soup-tower:run:"));
          return (pending.bests?.length ?? 0) + inbox.length;
        }),
        { timeout: 15_000 },
      )
      .toBe(0);
    await expect(page.getByTestId("final-panel")).toBeVisible();
    const info = (await (await page.request.get("/api/me")).json()) as { guest?: { playerId: string } };
    const result = (await page.evaluate(() => window.__monkSoupTower.session.result))!;
    await expect.poll(async () => (await mine(context, info.guest!.playerId)).score, { timeout: 15_000 }).toBeGreaterThanOrEqual(result.score!);
    await page.getByTestId("back-to-intro-button").click();
    await page.getByTestId("rank-tab").click();
    await expect(page.getByTestId("rank-board")).toHaveText("固定關卡");
    await expect(page.getByTestId("rank-mine")).toHaveAttribute("data-kind", "ranked", { timeout: 15_000 });
    await expect(page.getByTestId("rank-mine").getByTestId("guest-badge")).toBeVisible();
    await expect(page.getByTestId("rank-row").first()).toBeVisible();
    await expect(page.getByTestId("rank-time").first()).toContainText("秒");
    expect(await page.getByTestId("rank-row").count()).toBeLessThanOrEqual(10);
  });

  test("T6 讀不到前 100 名：顯示「暫時讀不到排行」、不自動重試，按「再試一次」恢復", async ({ page }) => {
    let count = 0;
    await page.route("**/api/games/monk-soup-tower/leaderboard?**", (route) => {
      count += 1;
      return count === 1 ? route.fulfill({ status: 500, body: "{}" }) : route.continue();
    });
    await page.goto(GAME);
    await page.getByTestId("rank-tab").click();
    await expect(page.getByTestId("rank-error")).toBeVisible();
    await page.waitForTimeout(1500);
    expect(count).toBe(1);
    await page.getByTestId("rank-retry").click();
    await expect(page.getByTestId("rank-error")).toHaveCount(0);
  });

  test("T10 歐盟地區：送達塔頂先問要不要上榜；按「不要」不建立訪客；在排行分頁按「上榜」才建立", async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop", "電腦測");
    const context = await newBrowser(browser, { "cf-ipcountry": "FR" });
    const page = await hydratedPage(context);
    await enter(page);
    await playToFinal(page);
    await expect(page.getByTestId("consent-prompt")).toBeVisible();
    await page.getByTestId("consent-no").click();
    await page.waitForTimeout(800);
    expect((await context.cookies()).find((c) => c.name === "gs_guest")).toBeUndefined();
    await page.getByTestId("back-to-intro-button").click();
    await page.getByTestId("rank-tab").click();
    await expect(page.getByTestId("rank-mine")).toHaveAttribute("data-kind", "declined");
    await page.getByTestId("rank-rejoin").click();
    await expect.poll(async () => (await context.cookies()).find((c) => c.name === "gs_guest") !== undefined, { timeout: 15_000 }).toBe(true);
    await context.close();
  });

  test("P8 送不出去：成績留在本機，網路恢復後再送", async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop", "電腦測");
    const context = await newBrowser(browser);
    const page = await hydratedPage(context);
    await page.route("**/api/games/monk-soup-tower/records/sync", (route) => route.abort());
    await enter(page);
    await playToFinal(page);
    await page.waitForTimeout(1200);
    expect((await context.cookies()).find((c) => c.name === "gs_guest")).toBeUndefined();
    const pending = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("game-station:monk-soup-tower:")));
    expect(pending.length).toBeGreaterThan(1);
    await page.unroute("**/api/games/monk-soup-tower/records/sync");
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect.poll(async () => (await context.cookies()).find((c) => c.name === "gs_guest") !== undefined, { timeout: 15_000 }).toBe(true);
    await context.close();
  });

  test("玩完一局只回報一次遊玩次數", async ({ page }) => {
    const posts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().includes("/api/play-count/")) posts.push(request.url());
    });
    await enter(page);
    await fallOff(page);
    await expect(page.getByTestId("final-panel")).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => posts.length, { timeout: 10_000 }).toBe(1);
    expect(posts[0]).toContain("/api/play-count/monk-soup-tower");
    await page.waitForTimeout(1200);
    expect(posts).toHaveLength(1);
  });
});
