import { expect, hydratedPage, randomIp, test, type Browser, type BrowserContext, type Page } from "./fixtures";

/**
 * 一路向下（驗收清單 docs/acceptance/mine-descent.md）。
 * 遊戲掛勾（只在開發版）：window.__mineDescent.session（MineSession）、.scene.fx、window.__mineDescentSound。
 */
const GAME = "/games/mine-descent";
const ORIGIN = "http://localhost:3000";
const RECORDS = "/api/games/mine-descent/records";
const LB = "/api/games/mine-descent/leaderboard";
const LOCAL = "game-station:mine-descent:v1";

type Snap = {
  phase: string;
  depth: number;
  score: number;
  hp: number;
  mult: number;
  headroom: number;
  result: { depth: number; total: number; reason: string; parts: { depth: number; graze: number; crystal: number } } | null;
};
type Hook = {
  session: {
    autopilot: boolean;
    timeScale: number;
    axis: number;
    phase: string;
    sim: { player: { x: number; hp: number; vx: number; ground: number | null; invuln: number }; time: number; scrolled: number };
    setAxis(axis: -1 | 0 | 1): void;
    snapshot(): Snap;
  };
  scene: { fx: { dust: number; sparks: number; rocks: number; alive: number; maxAlive: number } };
};
declare global {
  interface Window {
    __mineDescent: Hook;
    __mineDescentSound?: { state: Record<string, number | string | boolean>; log: { name: string }[] };
  }
}

const snap = (page: Page) => page.evaluate(() => window.__mineDescent.session.snapshot());
const unique = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (!["error", "warning"].includes(message.type())) return;
    const text = message.text();
    if (text.includes("GL Driver Message")) return;
    problems.push(`${message.type()}: ${text}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${String(error)}`));
  return problems;
}

/** 進遊戲畫面，停在準備畫面 */
async function enter(page: Page, path = GAME) {
  await page.goto(path);
  await page.getByTestId("depart-button").first().click();
  await expect(page.getByTestId("ready-panel")).toBeVisible({ timeout: 30_000 });
}

/**
 * 自動駕駛玩到一定深度，再把體力壓到 1 格、關掉自動駕駛讓它被崩塌線撞死；停在結算。
 * （自動駕駛撐得很久，不這樣做每個測試都要等好幾分鐘）
 */
async function playToFinal(page: Page, scale = 10, depth = 40) {
  if ((await snap(page)).phase === "ready") await page.getByTestId("depart-in-game").click();
  await page.evaluate((s) => {
    const session = window.__mineDescent.session;
    session.autopilot = true;
    session.timeScale = s;
  }, scale);
  await expect.poll(async () => (await snap(page)).depth, { timeout: 120_000, intervals: [200] }).toBeGreaterThanOrEqual(depth);
  await page.evaluate(() => {
    const session = window.__mineDescent.session;
    session.autopilot = false;
    session.setAxis(0);
    session.sim.player.hp = 1;
    session.sim.player.invuln = 0;
  });
  await expect(page.getByTestId("final-panel")).toBeVisible({ timeout: 120_000 });
}

test.describe("目錄、介紹頁與整頁切換", () => {
  test("A1 A2 I1 I2 首頁與全部遊戲看得到、點進介紹頁；有看板、紀錄、怎麼玩、計分、常見問題，只有一個廣告版位", async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto("/games");
    await expect(page.locator(`a[href="${GAME}"]`).first()).toBeAttached();
    await page.goto(GAME);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("一路向下");
    await expect(page.getByTestId("departure-board")).toBeVisible();
    await expect(page.getByTestId("zone")).toHaveCount(5);
    await expect(page.getByTestId("records-card")).toBeVisible();
    await expect(page.locator("#howto-title")).toBeVisible();
    await expect(page.locator("#scoring-title")).toBeVisible();
    await expect(page.locator("#faq-title")).toBeVisible();
    await expect(page.getByTestId("game-stage")).toHaveCount(0);
    expect(await page.locator("[data-ad-slot], [data-slot-id]").count()).toBeLessThanOrEqual(1);
    expect(problems).toEqual([]);
    await page.goto("/");
    await expect(page.locator(`a[href="${GAME}"]`).first()).toBeAttached();
  });

  test("I3 I4 I5 I6 只有出發鈕能開始；整頁切換、網址不變；返回鍵回介紹；重新整理回介紹；遊戲畫面沒有選單與廣告", async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto(GAME);
    await expect(page.getByTestId("game-stage")).toHaveCount(0);
    await page.getByTestId("depart-button").first().click();
    await expect(page.getByTestId("ready-panel")).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(GAME);
    await expect(page.locator("header").first()).toBeHidden();
    await page.goBack();
    await expect(page.getByTestId("departure-board")).toBeVisible();
    await expect(page.getByTestId("game-stage")).toHaveCount(0);
    await page.getByTestId("depart-button").first().click();
    await expect(page.getByTestId("ready-panel")).toBeVisible({ timeout: 30_000 });
    await page.reload();
    await expect(page.getByTestId("departure-board")).toBeVisible();
    await expect(page.getByTestId("game-stage")).toHaveCount(0);
    // 暫停選單的「回到遊戲介紹」
    await page.getByTestId("depart-button").first().click();
    await expect(page.getByTestId("ready-panel")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("depart-in-game").click();
    await page.keyboard.press("p");
    await page.getByTestId("pause-dialog").getByRole("button", { name: "回到遊戲介紹" }).click();
    await expect(page.getByTestId("departure-board")).toBeVisible();
    expect(problems).toEqual([]);
  });

  test("N5 介紹頁不載入 Phaser 與音檔，按出發才載入", async ({ page }) => {
    const urls: string[] = [];
    page.on("request", (request) => urls.push(request.url()));
    await page.goto(GAME);
    await page.waitForTimeout(800);
    expect(urls.filter((url) => /phaser|MineStage|scene\.ts|sfx\//.test(url))).toEqual([]);
    await page.getByTestId("depart-button").first().click();
    await expect(page.getByTestId("ready-panel")).toBeVisible({ timeout: 30_000 });
    expect(urls.some((url) => /sfx\//.test(url))).toBe(true);
  });
});

test.describe("操作與流程", () => {
  test("E1 F1 準備畫面要按開始、Enter 或空白鍵才開始；開始後左右鍵移動、放開停住；P 暫停、R 重新開始", async ({ page }) => {
    const problems = watchConsole(page);
    await enter(page);
    expect((await snap(page)).phase).toBe("ready");
    const t0 = await page.evaluate(() => window.__mineDescent.session.sim.time);
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => window.__mineDescent.session.sim.time)).toBe(t0);
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("hud")).toBeVisible();
    expect((await snap(page)).phase).toBe("playing");
    const x0 = await page.evaluate(() => window.__mineDescent.session.sim.player.x);
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => window.__mineDescent.session.axis)).toBe(1);
    await page.keyboard.up("ArrowRight");
    await expect.poll(() => page.evaluate(() => window.__mineDescent.session.axis)).toBe(0);
    expect(await page.evaluate(() => window.__mineDescent.session.sim.player.x)).toBeGreaterThan(x0);
    // 兩個方向一起按：以後按的為準
    await page.keyboard.down("a");
    await page.keyboard.down("d");
    expect(await page.evaluate(() => window.__mineDescent.session.axis)).toBe(1);
    await page.keyboard.up("d");
    expect(await page.evaluate(() => window.__mineDescent.session.axis)).toBe(-1);
    await page.keyboard.up("a");
    await page.keyboard.press("p");
    await expect(page.getByTestId("pause-dialog")).toBeVisible();
    const paused = await page.evaluate(() => window.__mineDescent.session.sim.time);
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => window.__mineDescent.session.sim.time)).toBe(paused);
    await page.getByTestId("resume-button").click();
    await expect.poll(async () => (await snap(page)).phase).toBe("playing");
    await page.keyboard.press("r");
    await expect.poll(() => page.evaluate(() => window.__mineDescent.session.sim.time)).toBeLessThan(paused);
    expect(problems).toEqual([]);
  });

  test("E2 觸控：按住左半邊往左、右半邊往右；兩根手指以後按的為準；放開、取消都停住", async ({ page }) => {
    await enter(page);
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("game-stage")).toHaveAttribute("data-phase", "playing");
    const press = (type: string, id: number, left: boolean) =>
      page.evaluate(
        ({ type, id, left }) => {
          const frame = document.querySelector("[data-testid=game-frame]")!;
          const box = frame.getBoundingClientRect();
          frame.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: "touch", clientX: box.left + box.width * (left ? 0.2 : 0.8), clientY: box.top + 200, bubbles: true }));
        },
        { type, id, left },
      );
    const axis = () => page.evaluate(() => window.__mineDescent.session.axis);
    await press("pointerdown", 1, true);
    expect(await axis()).toBe(-1);
    await press("pointerdown", 2, false);
    expect(await axis()).toBe(1);
    await press("pointerup", 2, false);
    expect(await axis()).toBe(-1);
    await press("pointercancel", 1, true);
    expect(await axis()).toBe(0);
    await press("pointerdown", 3, false);
    expect(await axis()).toBe(1);
    await press("pointerup", 3, false);
    expect(await axis()).toBe(0);
  });

  test("E1b 按住一個方向的自動重複不會蓋掉後按的方向；準備畫面焦點在開始鈕時空白鍵能開始（Codex 審查第 11 項）", async ({ page }) => {
    await enter(page);
    // 焦點在開始鈕上按空白鍵：按鈕自己的點擊開始遊戲
    await expect(page.getByTestId("depart-in-game")).toBeFocused();
    await page.keyboard.press("Space");
    await expect.poll(async () => (await snap(page)).phase).toBe("playing");
    const axis = () => page.evaluate(() => window.__mineDescent.session.axis);
    await page.evaluate(() => {
      const fire = (type: string, key: string, repeat = false) => document.body.dispatchEvent(new KeyboardEvent(type, { key, repeat, bubbles: true }));
      fire("keydown", "ArrowLeft");
      fire("keydown", "ArrowRight");
      // 左鍵還按著、瀏覽器持續送自動重複：不能把「後按的是右」改回左
      fire("keydown", "ArrowLeft", true);
      fire("keydown", "ArrowLeft", true);
    });
    expect(await axis()).toBe(1);
    await page.evaluate(() => document.body.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowRight", bubbles: true })));
    expect(await axis()).toBe(-1);
    await page.evaluate(() => document.body.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowLeft", bubbles: true })));
    expect(await axis()).toBe(0);
  });

  test("E2b 多指：一根手指滑過中線算最新，放開另一根後以最新的為準（Codex 審查第 11 項）", async ({ page }) => {
    await enter(page);
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("game-stage")).toHaveAttribute("data-phase", "playing");
    const send = (type: string, id: number, left: boolean) =>
      page.evaluate(
        ({ type, id, left }) => {
          const frame = document.querySelector("[data-testid=game-frame]")!;
          const box = frame.getBoundingClientRect();
          frame.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: "touch", clientX: box.left + box.width * (left ? 0.2 : 0.8), clientY: box.top + 200, bubbles: true }));
        },
        { type, id, left },
      );
    const axis = () => page.evaluate(() => window.__mineDescent.session.axis);
    await send("pointerdown", 1, true); // 先按左
    await send("pointerdown", 2, false); // 再按右
    await send("pointermove", 1, false); // 手指 1 滑到右半邊：現在它才是最新的
    expect(await axis()).toBe(1);
    await send("pointermove", 1, true); // 手指 1 又滑回左半邊：最新的是左
    expect(await axis()).toBe(-1);
    await send("pointerup", 1, true); // 放開手指 1：剩下手指 2（右）
    expect(await axis()).toBe(1);
    await send("pointerup", 2, false);
    expect(await axis()).toBe(0);
  });

  test("E4 切到別的分頁自動暫停；頁面不被方向鍵與空白鍵捲動", async ({ page }) => {
    await enter(page);
    await page.keyboard.press("Enter");
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(page.getByTestId("pause-dialog")).toBeVisible();
    await page.getByTestId("resume-button").click();
    const before = await page.evaluate(() => window.scrollY);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
  });

  test("F2 F3 自動駕駛一局到結算：失敗後先有動畫再結算；結算顯示深度、總分、三項得分", async ({ page }) => {
    const problems = watchConsole(page);
    await enter(page);
    await playToFinal(page);
    const state = await snap(page);
    expect(state.phase).toBe("over");
    expect(state.result!.depth).toBeGreaterThanOrEqual(40);
    await expect(page.getByTestId("final-depth")).toHaveAttribute("data-depth", String(state.result!.depth));
    await expect(page.getByTestId("final-total")).toHaveAttribute("data-total", String(state.result!.total));
    const parts = state.result!.parts;
    expect(parts.depth + parts.graze + parts.crystal).toBe(state.result!.total);
    await expect(page.getByTestId("part-depth")).toBeVisible();
    await expect(page.getByTestId("record-note").first()).toHaveAttribute("data-new-record", "true");
    expect(problems).toEqual([]);
  });

  test("F4 A5 再逃一次：換新的一局（新種子）、準備畫面不再出現；R 重新開始", async ({ page }) => {
    await enter(page);
    await playToFinal(page);
    const seed = await page.evaluate(() => (window.__mineDescent.session as unknown as { sim: { seed: number } }).sim.seed);
    await page.getByTestId("again-button").click();
    await expect(page.getByTestId("hud")).toBeVisible();
    await expect.poll(async () => (await snap(page)).phase).toBe("playing");
    expect(await page.evaluate(() => (window.__mineDescent.session as unknown as { sim: { seed: number } }).sim.seed)).not.toBe(seed);
    // 自動駕駛與加速是上一局留下來的設定，先關掉才量得到重新開始後的起點
    await page.evaluate(() => {
      window.__mineDescent.session.autopilot = false;
      window.__mineDescent.session.timeScale = 1;
    });
    await page.keyboard.press("r");
    expect((await snap(page)).depth).toBe(0);
  });

  test("F5 前 3 秒顯示左右半邊的觸控提示，之後淡出", async ({ page }) => {
    await enter(page);
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("hint-left")).toBeVisible();
    await expect(page.getByTestId("hint-right")).toBeVisible();
    await expect(page.getByTestId("hint-left")).toHaveCount(0, { timeout: 6000 });
  });

  test("F6 體力與崩塌線：扣血後畫面上的安全帽少一頂；靠近崩塌線出現提示", async ({ page }) => {
    await enter(page);
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("hud-hearts")).toHaveAttribute("data-hp", "6");
    // 什麼都不做：起始岩板往上升，撞到崩塌線扣血
    await expect.poll(async () => (await snap(page)).hp, { timeout: 20_000 }).toBeLessThan(6);
    await expect(page.getByTestId("hud-hearts")).not.toHaveAttribute("data-hp", "6");
  });
});

test.describe("結算、紀錄與分享", () => {
  test("J1 J3 J5 J6 結算顯示、紀錄存本機、分享面板與成績連結、成績圖 1080×1350", async ({ page, context }) => {
    const problems = watchConsole(page);
    await enter(page);
    await playToFinal(page);
    const result = (await snap(page)).result!;
    const saved = JSON.parse((await page.evaluate((key) => localStorage.getItem(key), LOCAL))!) as { score: number; depth: number };
    expect(saved).toEqual({ score: result.total, depth: result.depth });

    await page.getByTestId("share-button").click();
    await expect(page.getByTestId("share-panel")).toBeVisible();
    await expect(page.getByTestId("share-card")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("share-line")).toBeVisible();
    await expect(page.getByTestId("share-copy")).toBeVisible();
    const size = await page.getByTestId("share-card").evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight]);
    expect(size).toEqual([1080, 1350]);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => undefined);
    await page.getByTestId("share-copy").click();
    const link = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
    if (link) {
      const friend = await context.newPage();
      await friend.goto(link);
      await expect(friend.getByTestId("shared-banner")).toContainText(String(result.total).replace(/\B(?=(\d{3})+(?!\d))/g, ","));
      const og = await friend.locator("meta[property='og:image']").getAttribute("content");
      expect(og).toContain("/card");
      const card = await friend.request.get(og!);
      expect(card.status()).toBe(200);
      expect(card.headers()["content-type"]).toBe("image/png");
    }
    expect(problems).toEqual([]);
  });

  test("J7 亂改的成績代碼不會讓網站出錯（介紹頁照常、成績圖 404）", async ({ page }) => {
    const response = await page.goto(`${GAME}/r/AAAAAAAAAAAAAAAAAAAAAAAAAAAA`);
    expect(response?.status()).toBe(200);
    await expect(page.getByTestId("departure-board")).toBeVisible();
    await expect(page.getByTestId("shared-banner")).toHaveCount(0);
    expect((await page.request.get(`${GAME}/r/AAAAAAAAAAAAAAAAAAAAAAAAAAAA/card`)).status()).toBe(404);
  });

  test("J2 瀏覽器不能儲存時照常能玩完一局", async ({ page }) => {
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

test.describe("聲音與特效", () => {
  test("M1 M6 M7 喇叭鈕只開關音效、記在本機、暫停選單同步；沒有音符鈕；15 個音檔都載入", async ({ page }) => {
    await enter(page);
    await expect.poll(() => page.evaluate(() => window.__mineDescentSound!.state.loaded)).toBe(15);
    expect(await page.evaluate(() => window.__mineDescentSound!.state.failed)).toBe(0);
    await page.getByTestId("depart-in-game").click();
    await expect(page.getByTestId("music-button")).toHaveCount(0);
    const box = await page.getByTestId("mute-button").boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await page.getByTestId("mute-button").click();
    await expect.poll(() => page.evaluate(() => window.__mineDescentSound!.state.muted)).toBe(true);
    await page.keyboard.press("p");
    await expect(page.getByTestId("sound-switch")).toHaveAttribute("aria-checked", "false");
    await page.getByTestId("sound-switch").click();
    await expect(page.getByTestId("sound-switch")).toHaveAttribute("aria-checked", "true");
    expect(await page.evaluate(() => window.__mineDescentSound!.state.active)).toBe(false);
    await page.getByTestId("resume-button").click();
    await expect.poll(() => page.evaluate(() => window.__mineDescentSound!.state.active)).toBe(true);
  });

  test("M2 M3 M8 動作對應的音效有送出（log）；音檔載入失敗照常可玩", async ({ page }) => {
    await page.route("**/sfx/**", (route) => route.fulfill({ status: 404, body: "" }));
    const problems: string[] = [];
    page.on("pageerror", (error) => problems.push(String(error)));
    await enter(page);
    await page.getByTestId("depart-in-game").click();
    await page.evaluate(() => {
      window.__mineDescent.session.autopilot = true;
      window.__mineDescent.session.timeScale = 8;
    });
    await expect.poll(() => page.evaluate(() => window.__mineDescentSound!.log.map((entry) => entry.name)), { timeout: 60_000 }).toEqual(expect.arrayContaining(["game-start.mp3", "land.mp3"]));
    expect(await page.evaluate(() => window.__mineDescentSound!.state.loaded)).toBe(0);
    expect(problems).toEqual([]);
  });

  test("G5 G7 粒子不超過 160；自動駕駛玩一局沒有主控台錯誤", async ({ page }) => {
    const problems = watchConsole(page);
    await enter(page);
    await playToFinal(page);
    const fx = await page.evaluate(() => window.__mineDescent.scene.fx);
    expect(fx.maxAlive).toBeLessThanOrEqual(160);
    expect(fx.dust).toBeGreaterThan(0);
    expect(problems).toEqual([]);
  });

  test("G6 減少動態效果：沒有粒子、沒有晃動、危險泛紅關掉，只留文字提示", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await enter(page);
    await expect(page.getByTestId("game-stage")).toHaveAttribute("data-reduced-motion", "true");
    await playToFinal(page);
    const fx = await page.evaluate(() => window.__mineDescent.scene.fx);
    expect(fx).toMatchObject({ dust: 0, sparks: 0, rocks: 0, alive: 0 });
  });
});

test.describe("多語系與版面", () => {
  for (const [prefix, title] of [
    ["", "一路向下"],
    ["/zh-cn", "一路向下"],
    ["/en", "Down We Go"],
    ["/ja", "ひたすら下へ"],
    ["/ko", "끝없이 아래로"],
    ["/vi", "Xuống Mãi"],
    ["/pt", "Sempre Para Baixo"],
  ] as const) {
    test(`K1 K3 ${prefix || "/"} 介紹頁有標題、語言標示正確`, async ({ page }) => {
      await page.goto(`${prefix}${GAME}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      await expect(page.getByTestId("departure-board")).toBeVisible();
      const lang = await page.locator("html").getAttribute("lang");
      expect(lang?.toLowerCase().startsWith(prefix ? prefix.slice(1).slice(0, 2) : "zh")).toBe(true);
    });
  }

  for (const width of [360, 390, 1280, 1920]) {
    test(`N1 ${width}px 介紹頁與遊戲畫面沒有橫向捲軸`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/vi" + GAME);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.getByTestId("depart-button").first().click();
      await expect(page.getByTestId("ready-panel")).toBeVisible({ timeout: 30_000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const box = await page.getByTestId("depart-in-game").boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    });
  }

  test("K6 越南文與葡文最長的畫面（準備、結算）沒有橫向溢出，結算的按鈕都在遊戲框內", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    for (const prefix of ["/vi", "/pt"]) {
      await enter(page, `${prefix}${GAME}`);
      await playToFinal(page);
      const fits = await page.evaluate(() => {
        const frame = document.querySelector("[data-testid=game-frame]")!.getBoundingClientRect();
        return ["share-button", "again-button", "back-to-intro-button"].every((id) => {
          const rect = document.querySelector(`[data-testid=${id}]`)!.getBoundingClientRect();
          return rect.bottom <= frame.bottom + 1 && rect.right <= frame.right + 1 && rect.left >= frame.left - 1;
        });
      });
      expect(fits, prefix).toBe(true);
    }
  });

  test("N2 N3 遊戲畫面上所有按鈕至少 44×44，圖示鈕有無障礙名稱", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await enter(page);
    await page.getByTestId("depart-in-game").click();
    for (const id of ["pause-button", "mute-button", "back-button", "restart-button"]) {
      const button = page.getByTestId(id);
      const box = await button.boundingBox();
      expect(box!.width, id).toBeGreaterThanOrEqual(44);
      expect(box!.height, id).toBeGreaterThanOrEqual(44);
      expect(await button.getAttribute("aria-label"), id).toBeTruthy();
    }
  });

  test("L2 累計遊玩次數預設不顯示", async ({ page }) => {
    await page.goto(GAME);
    await expect(page.getByTestId("play-count")).toHaveCount(0);
  });
});

// ---- 帳號、訪客與排行榜 ----
const newBrowser = (browser: Browser, headers: Record<string, string> = {}) =>
  browser.newContext({ extraHTTPHeaders: { "cf-connecting-ip": randomIp(), ...headers } });

const best = (score: number, mode: "score" | "depth" = "score", at = Date.now() - 1000) => ({ mode, score, achievedAt: at });

async function postAsNew(context: BrowserContext | Page, bests: ReturnType<typeof best>[], extra: Record<string, unknown> = {}) {
  const syncId = `id-${unique()}`;
  const response = await context.request.post(`${RECORDS}/sync`, { headers: { Origin: ORIGIN }, data: { syncId, playerId: null, bests, ...extra } });
  return { response, syncId, body: (await response.json().catch(() => null)) as { score?: number | null; depth?: number | null; guest?: { playerId: string }; error?: string } | null };
}

const mine = async (context: BrowserContext, scope: string, player: string) =>
  (await context.request.get(`${LB}/me?scope=${scope}&player=${player}`)).json() as Promise<{ rank: number | null; score: number | null; total: number; toTop100: number | null }>;

test.describe("帳號紀錄與排行榜 API", () => {
  test("T1 T2 T5 T8 P3 建立訪客上榜；取高值；每人一次；不帶個人資料；名次不快取", async ({ browser }) => {
    const [a, b] = await Promise.all([newBrowser(browser), newBrowser(browser)]);
    const first = await postAsNew(a, [best(7000), best(300, "depth")]);
    expect(first.response.status()).toBe(200);
    expect(first.body).toMatchObject({ score: 7000, depth: 300 });
    const cookie = (await a.cookies()).find((c) => c.name === "gs_guest")!;
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax" });
    const guestA = first.body!.guest!.playerId;

    const sync = (context: BrowserContext, bests: ReturnType<typeof best>[], playerId: string) =>
      context.request.post(`${RECORDS}/sync`, { headers: { Origin: ORIGIN }, data: { syncId: `id-${unique()}`, playerId, bests } });
    // 同一個人再送較低的：不覆蓋；較高的：換上
    expect(((await (await sync(a, [best(100)], guestA)).json()) as { score: number }).score).toBe(7000);
    expect(((await (await sync(a, [best(8000)], guestA)).json()) as { score: number }).score).toBe(8000);

    const second = await postAsNew(b, [best(8000)]);
    const guestB = second.body!.guest!.playerId;
    const [ra, rb] = [await mine(a, "score", guestA), await mine(b, "score", guestB)];
    expect(ra.score).toBe(8000);
    expect(rb.score).toBe(8000);
    expect(ra.rank).not.toBe(rb.rank);

    const top = await (await a.request.get(`${LB}?scope=score`)).json();
    expect(top.rows.length).toBeGreaterThan(0);
    expect(Object.keys(top.rows[0]).sort()).toEqual(["achievedAt", "color", "guest", "nick", "rank", "score"]);
    expect(JSON.stringify(top)).not.toContain(guestA);
    const depthTop = await (await a.request.get(`${LB}?scope=depth`)).json();
    expect(depthTop.scope).toBe("depth");
    const response = await a.request.get(`${LB}/me?scope=score&player=${guestA}`);
    expect(response.headers()["cache-control"]).toContain("no-store");
    await Promise.all([a.close(), b.close()]);
  });

  test("P2 P5 沒有身分 401；格式或範圍不對 400 且不寫入；身分不同 409；跨站請求 403；超過 8 KB 被拒；舊格式被拒", async ({ browser }) => {
    const context = await newBrowser(browser);
    expect((await context.request.get(RECORDS)).status()).toBe(401);
    expect((await postAsNew(context, [best(10_000_000)])).response.status()).toBe(400);
    expect((await postAsNew(context, [best(1_000_000, "depth")])).response.status()).toBe(400);
    expect((await postAsNew(context, [{ ...best(5), mode: "daily" as never }])).response.status()).toBe(400);
    expect((await postAsNew(context, [{ ...best(5), dateKey: null } as never])).response.status()).toBe(400);
    expect((await context.cookies()).find((c) => c.name === "gs_guest")).toBeUndefined();

    const ok = await postAsNew(context, [best(50)]);
    expect(ok.response.status()).toBe(200);
    const id = ok.body!.guest!.playerId;
    expect((await context.request.get(`${RECORDS}?player=${id}`)).status()).toBe(200);
    expect((await context.request.get(`${RECORDS}?player=someone-else`)).status()).toBe(409);
    const mismatch = await context.request.post(`${RECORDS}/sync`, { headers: { Origin: ORIGIN }, data: { syncId: `id-${unique()}`, playerId: "someone-else", bests: [best(1)] } });
    expect(mismatch.status()).toBe(409);
    const cross = await context.request.post(`${RECORDS}/sync`, { headers: { Origin: "https://evil.example" }, data: { syncId: `id-${unique()}`, playerId: id, bests: [best(1)] } });
    expect(cross.status()).toBe(403);
    const huge = await context.request.post(`${RECORDS}/sync`, { headers: { Origin: ORIGIN, "content-type": "application/json" }, data: JSON.stringify({ pad: "x".repeat(9000) }) });
    expect([400, 413]).toContain(huge.status());
    expect((await context.request.get(`${LB}?scope=daily`)).status()).toBe(400);
    expect((await context.request.get(`${LB}/me?scope=week&player=${id}`)).status()).toBe(400);
    await context.close();
  });

  test("T9 回應掉了、用同一個 syncId 重送：找回同一個訪客，不重複建立", async ({ browser }) => {
    const context = await newBrowser(browser);
    const first = await postAsNew(context, [best(900)]);
    const id = first.body!.guest!.playerId;
    await context.clearCookies();
    const again = await context.request.post(`${RECORDS}/sync`, { headers: { Origin: ORIGIN }, data: { syncId: first.syncId, playerId: null, bests: [best(900)] } });
    expect(((await again.json()) as { guest: { playerId: string } }).guest.playerId).toBe(id);
    await context.close();
  });

  test("T11 歐盟地區：沒帶同意回 403 consent_required，帶了才建立訪客", async ({ browser }) => {
    const context = await newBrowser(browser, { "cf-ipcountry": "FR" });
    const refused = await postAsNew(context, [best(10)]);
    expect(refused.response.status()).toBe(403);
    expect(refused.body?.error).toBe("consent_required");
    const allowed = await postAsNew(context, [best(10)], { consent: true });
    expect(allowed.response.status()).toBe(200);
    await context.close();
  });
});

test.describe("玩完一局：訪客上榜", () => {
  test("P17 T8 只看介紹頁不呼叫紀錄 API；玩完一局才送出，建立訪客，回介紹頁後榜上看得到自己", async ({ page, context }) => {
    const calls: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/games/mine-descent/records")) calls.push(request.method());
    });
    await page.goto(GAME);
    await page.waitForTimeout(800);
    expect(calls).toEqual([]);
    await page.getByTestId("depart-button").first().click();
    await expect(page.getByTestId("ready-panel")).toBeVisible({ timeout: 30_000 });
    await playToFinal(page);
    await expect.poll(async () => (await context.cookies()).find((c) => c.name === "gs_guest") !== undefined, { timeout: 15_000 }).toBe(true);
    expect(calls).toContain("POST");
    const info = (await (await page.request.get("/api/me")).json()) as { guest?: { playerId: string } };
    const result = (await snap(page)).result!;
    await expect.poll(async () => (await mine(context, "depth", info.guest!.playerId)).score, { timeout: 15_000 }).toBeGreaterThanOrEqual(result.depth);
    await page.getByTestId("back-to-intro-button").click();
    await expect(page.getByTestId("departure-board")).toBeVisible();
    await page.getByTestId("rank-tab").click();
    await expect(page.getByTestId("leaderboard")).toBeVisible();
    await expect(page.getByTestId("rank-mine")).toHaveAttribute("data-kind", "ranked", { timeout: 15_000 });
    await expect(page.getByTestId("rank-mine").getByTestId("guest-badge")).toBeVisible();
    await expect(page.getByTestId("rank-row").first()).toBeVisible();
    for (const scope of ["score", "depth"]) {
      await page.getByTestId(`rank-scope-${scope}`).click();
      await expect(page.getByTestId("rank-updated").or(page.getByTestId("rank-empty")).first()).toBeAttached();
    }
  });

  test("T7 讀不到前 100 名：顯示「暫時讀不到排行」、不自動重試，按「再試一次」恢復", async ({ page }) => {
    let count = 0;
    await page.route("**/api/games/mine-descent/leaderboard?**", (route) => {
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

  test("T11 歐盟地區：結算先問要不要上榜；按「不要」不建立訪客、記在本機；按「上榜」才建立", async ({ browser }) => {
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

  test("P9 P10 送不出去：成績留在本機，網路恢復後再送，成功後榜上有這筆", async ({ browser }) => {
    const context = await newBrowser(browser);
    const page = await hydratedPage(context);
    await page.route("**/api/games/mine-descent/records/sync", (route) => route.abort());
    await enter(page);
    await playToFinal(page);
    await page.waitForTimeout(1200);
    expect((await context.cookies()).find((c) => c.name === "gs_guest")).toBeUndefined();
    const stored = JSON.parse((await page.evaluate((key) => localStorage.getItem(key), LOCAL))!) as { score: number };
    expect(stored.score).toBeGreaterThan(0);
    await page.unroute("**/api/games/mine-descent/records/sync");
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect.poll(async () => (await context.cookies()).find((c) => c.name === "gs_guest") !== undefined, { timeout: 15_000 }).toBe(true);
    await context.close();
  });
});
