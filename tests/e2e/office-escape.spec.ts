import { expect, hydratedPage, randomIp, test, type Browser, type BrowserContext, type Page } from "./fixtures";

/**
 * 下班逃離辦公室（驗收清單 docs/acceptance/office-escape.md）。
 * 遊戲掛勾（只在開發版）：window.__officeEscape.session、window.__officeEscapeSound。
 * 音檔還沒交來之前載入會 404，主控台那幾則不算錯誤（等音檔放進 public 後可以拿掉 watchConsole 裡的過濾）。
 */
const GAME = "/games/office-escape";
const ORIGIN = "http://localhost:3000";
const RECORDS = "/api/games/office-escape/records";
const LB = "/api/games/office-escape/leaderboard";
const LOCAL = "game-station:office-escape:v1";

type Snap = {
  phase: string;
  paused: boolean;
  segment: number;
  tick: number;
  x: number;
  jump: number;
  stun: string | null;
  score: number;
  event: { pool: string; line: number; order: number[] } | null;
  result: { ending: string; hidden: boolean; total: number; parts: Record<string, number> } | null;
};
type Hook = {
  session: {
    autopilot: boolean;
    timeScale: number;
    getSnapshot(): Snap;
    sim: { z: number; lane: number; x: number; tick: number; calledByBoss: boolean; event: unknown; finished: boolean };
    depart(): void;
    moveLane(d: -1 | 1): void;
    jump(): void;
  };
};
declare global {
  interface Window {
    __officeEscape: Hook;
    __officeEscapeSound?: { state: Record<string, number | string | boolean>; log: { name: string }[] };
  }
}

const snap = (page: Page) => page.evaluate(() => window.__officeEscape.session.getSnapshot());
const unique = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const today = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);

function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (!["error", "warning"].includes(message.type())) return;
    const text = message.text();
    if (text.includes("GL Driver Message")) return;
    if (/office-escape\/0\.1\.0\/(sfx|music)\//.test(text)) return;
    problems.push(`${message.type()}: ${text}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${String(error)}`));
  return problems;
}

async function enter(page: Page, path = GAME) {
  await page.goto(path);
  await page.getByTestId("depart-button").first().click();
  await expect(page.getByTestId("briefing")).toBeVisible({ timeout: 30_000 });
}

/** 自動駕駛跑完整局（時間加速），遇到每段介紹就出發；停在結算 */
async function playToFinal(page: Page, scale = 6) {
  await page.evaluate((s) => {
    const session = window.__officeEscape.session;
    session.autopilot = true;
    session.timeScale = s;
  }, scale);
  await expect
    .poll(
      async () => {
        const state = await snap(page);
        if (state.phase === "briefing") await page.evaluate(() => window.__officeEscape.session.depart());
        return state.phase;
      },
      { timeout: 90_000, intervals: [200] },
    )
    .toBe("final");
  await expect(page.getByTestId("final-panel")).toBeVisible();
}

test.describe("目錄、介紹頁與整頁切換", () => {
  test("A2 A3 I1 I2 首頁與全部遊戲看得到、點進介紹頁；有看板、紀錄、怎麼玩、計分、常見問題，只有一個廣告版位", async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto("/games");
    const card = page.locator(`a[href="${GAME}"]`).first();
    await expect(card).toBeVisible();
    await card.click();
    await expect(page).toHaveURL(GAME);
    await expect(page.getByTestId("departure-board")).toBeVisible();
    await expect(page.getByTestId("records-card")).toBeVisible();
    await expect(page.locator("[data-testid=route-segment]")).toHaveCount(4);
    await expect(page.locator("#howto-title")).toBeVisible();
    await expect(page.locator("#scoring-title")).toBeVisible();
    await expect(page.locator("#faq-title")).toBeVisible();
    await expect(page.getByTestId("game-stage")).toHaveCount(0);
    expect(await page.locator("[data-ad-slot], [data-slot-id]").count()).toBeLessThanOrEqual(1);
    expect(problems).toEqual([]);
    // 首頁也有（熱門榜、主推區之外的遊戲列表）
    await page.goto("/");
    await expect(page.locator(`a[href="${GAME}"]`).first()).toBeAttached();
  });

  test("I3 I4 I5 I6 只有出發鈕能開始；整頁切換、網址不變；返回鍵回介紹；重新整理回介紹；遊戲畫面沒有選單與廣告", async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto(GAME);
    await page.locator("img[alt]").first().click({ trial: true }).catch(() => undefined);
    await expect(page.getByTestId("game-stage")).toHaveCount(0);
    await page.getByTestId("depart-button").first().click();
    await expect(page.getByTestId("briefing")).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(GAME);
    await expect(page.locator("header").first()).toBeHidden();
    await expect(page.getByTestId("hud")).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId("departure-board")).toBeVisible();
    await expect(page.getByTestId("game-stage")).toHaveCount(0);
    await page.getByTestId("depart-button").first().click();
    await expect(page.getByTestId("briefing")).toBeVisible({ timeout: 30_000 });
    await page.reload();
    await expect(page.getByTestId("departure-board")).toBeVisible();
    await expect(page.getByTestId("game-stage")).toHaveCount(0);
    // 暫停選單的「回到遊戲介紹」
    await page.getByTestId("depart-button").first().click();
    await expect(page.getByTestId("briefing")).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press("Enter");
    await page.keyboard.press("p");
    await page.getByTestId("pause-dialog").getByRole("button", { name: "回到遊戲介紹" }).click();
    await expect(page.getByTestId("departure-board")).toBeVisible();
    expect(problems).toEqual([]);
  });

  test("N5 介紹頁不載入 three.js 與音檔，按出發才載入", async ({ page }) => {
    const urls: string[] = [];
    page.on("request", (request) => urls.push(request.url()));
    await page.goto(GAME);
    await page.waitForTimeout(800);
    expect(urls.filter((url) => /three|EscapeStage|scene\.ts|sfx\/|music\//.test(url))).toEqual([]);
    await page.getByTestId("depart-button").first().click();
    await expect(page.getByTestId("briefing")).toBeVisible({ timeout: 30_000 });
    expect(urls.some((url) => /sfx\//.test(url))).toBe(true);
  });
});

test.describe("操作與流程", () => {
  test("E2 F1 F2 鍵盤換線與跳躍、一局四段到結算；奔跑畫面有時鐘、點名倒數、段落與分數", async ({ page }) => {
    const problems = watchConsole(page);
    await enter(page);
    await expect(page.getByTestId("briefing-name")).toHaveText("座位區");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("game-stage")).toHaveAttribute("data-phase", "running");
    for (const id of ["hud-clock", "hud-call", "hud-segment", "hud-score"]) await expect(page.getByTestId(id)).toBeVisible();
    await expect(page.getByTestId("hud-clock")).toHaveText(/^18:00:\d\d$/);
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(250);
    expect((await page.evaluate(() => window.__officeEscape.session.sim.lane))).toBe(-1);
    await page.keyboard.press("d");
    await page.waitForTimeout(250);
    expect((await page.evaluate(() => window.__officeEscape.session.sim.lane))).toBe(0);
    await page.keyboard.press("ArrowUp");
    await expect.poll(async () => (await snap(page)).jump).toBeGreaterThan(0);
    // 空白鍵和方向鍵不捲動頁面
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await page.evaluate(() => (window.__officeEscape.session.autopilot = true));
    await playToFinal(page);
    await expect(page.getByTestId("ending-title")).toBeVisible();
    await expect(page.getByTestId("final-total")).toHaveAttribute("data-total", /\d+/);
    expect(problems).toEqual([]);
  });

  test("E3 B11 E4 突發事件：放慢、1／2／3 選擇、超時算選錯；暫停；切分頁自動暫停", async ({ page }) => {
    await enter(page);
    // 直接把玩家放到第 1 段的突發事件前面一點（座標見 lib/games/office-escape/route.ts 的 LAYOUT.events）
    await page.evaluate(() => {
      const s = window.__officeEscape.session;
      s.depart();
      s.sim.z = 46 - 0.3;
    });
    await expect.poll(async () => (await snap(page)).event !== null, { timeout: 30_000, intervals: [50] }).toBe(true);
    await expect(page.getByTestId("event-dialog")).toBeVisible();
    await expect(page.getByTestId("event-prompt")).not.toHaveText("");
    await expect(page.getByTestId("event-option-0")).toBeVisible();
    await expect(page.getByTestId("event-option-2")).toBeVisible();
    // 超時沒回答：3 秒後算選錯（分數 0、事件關掉）
    await page.waitForTimeout(3400);
    await expect(page.getByTestId("event-dialog")).toHaveCount(0);
    expect((await snap(page)).result).toBeNull();
    // 暫停：P 暫停、再按 P 繼續；切到背景自動暫停
    await page.keyboard.press("p");
    await expect(page.getByTestId("pause-dialog")).toBeVisible();
    const t1 = (await snap(page)).tick;
    await page.waitForTimeout(400);
    expect((await snap(page)).tick).toBe(t1);
    await page.keyboard.press("p");
    await expect(page.getByTestId("pause-dialog")).toHaveCount(0);
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(page.getByTestId("pause-dialog")).toBeVisible();
  });

  test("E1 E6 觸控：左右滑 30 px 以上才換線、往上滑跳；多指不會連跳", async ({ page }) => {
    await enter(page);
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("game-stage")).toHaveAttribute("data-phase", "running");
    const gesture = (dx: number, dy: number, id = 1) =>
      page.evaluate(
        ({ dx, dy, id }) => {
          const frame = document.querySelector("[data-testid=game-frame]")!;
          const make = (type: string, x: number, y: number) =>
            new PointerEvent(type, { pointerId: id, pointerType: "touch", clientX: x, clientY: y, bubbles: true, isPrimary: id === 1 });
          frame.dispatchEvent(make("pointerdown", 200, 300));
          frame.dispatchEvent(make("pointermove", 200 + dx, 300 + dy));
          frame.dispatchEvent(make("pointerup", 200 + dx, 300 + dy));
        },
        { dx, dy, id },
      );
    await gesture(20, 0);
    expect(await page.evaluate(() => window.__officeEscape.session.sim.lane)).toBe(0);
    await gesture(60, 0);
    expect(await page.evaluate(() => window.__officeEscape.session.sim.lane)).toBe(1);
    await page.waitForTimeout(250);
    await gesture(0, -60);
    await expect.poll(async () => (await snap(page)).jump).toBeGreaterThan(0);
    // 第二根手指在第一根還沒放開時的滑動不算
    await page.waitForTimeout(700);
    const before = await page.evaluate(() => window.__officeEscape.session.sim.lane);
    await page.evaluate(() => {
      const frame = document.querySelector("[data-testid=game-frame]")!;
      const make = (type: string, id: number, x: number) => new PointerEvent(type, { pointerId: id, pointerType: "touch", clientX: x, clientY: 300, bubbles: true });
      frame.dispatchEvent(make("pointerdown", 7, 200));
      frame.dispatchEvent(make("pointerdown", 8, 200));
      frame.dispatchEvent(make("pointermove", 8, -100));
      frame.dispatchEvent(make("pointerup", 8, -100));
      frame.dispatchEvent(make("pointerup", 7, 200));
    });
    expect(await page.evaluate(() => window.__officeEscape.session.sim.lane)).toBe(before);
  });

  test("B16 G6 減少動態效果：事件不放慢", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await enter(page);
    await expect(page.getByTestId("game-stage")).toHaveAttribute("data-reduced-motion", "true");
  });
});

test.describe("結算、紀錄與分享", () => {
  test("F8 J1 J3 J5 J6 J7 結算顯示、紀錄存本機、分享面板與成績連結、成績圖 1080×1350", async ({ page, context }) => {
    const problems = watchConsole(page);
    await enter(page);
    await playToFinal(page);
    const result = await snap(page);
    expect(result.result?.ending).toBe("fast");
    await expect(page.getByTestId("part-time")).toBeVisible();
    await expect(page.getByTestId("record-note")).toHaveAttribute("data-new-record", "true");
    const saved = JSON.parse((await page.evaluate((key) => localStorage.getItem(key), LOCAL))!) as { daily: Record<string, number>; best: number };
    expect(saved.best).toBe(result.result!.total);
    expect(saved.daily[today()]).toBe(result.result!.total);

    await page.getByTestId("share-button").click();
    await expect(page.getByTestId("share-panel")).toBeVisible();
    await expect(page.getByTestId("share-card")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("share-line")).toBeVisible();
    await expect(page.getByTestId("share-copy")).toBeVisible();
    const src = await page.getByTestId("share-card").getAttribute("src");
    expect(src).toMatch(/^blob:/);
    const size = await page.getByTestId("share-card").evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight]);
    expect(size).toEqual([1080, 1350]);
    // 成績連結：從分享面板複製的連結打得開、顯示朋友的分數、社群預覽圖是成績圖
    await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => undefined);
    await page.getByTestId("share-copy").click();
    const link = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
    if (link) {
      const friend = await context.newPage();
      await friend.goto(link);
      await expect(friend.getByTestId("shared-banner")).toContainText(String(result.result!.total).replace(/\B(?=(\d{3})+(?!\d))/g, ","));
      const og = await friend.locator("meta[property='og:image']").getAttribute("content");
      expect(og).toContain("/card");
      const card = await friend.request.get(og!);
      expect(card.status()).toBe(200);
      expect(card.headers()["content-type"]).toBe("image/png");
    }
    expect(problems).toEqual([]);
  });

  test("J7 亂改的成績代碼不會讓網站出錯（介紹頁照常、成績圖 404）", async ({ page }) => {
    const response = await page.goto(`${GAME}/r/AAAAAAAAAAAAAAAAAAAAAAAA`);
    expect(response?.status()).toBe(200);
    await expect(page.getByTestId("departure-board")).toBeVisible();
    await expect(page.getByTestId("shared-banner")).toHaveCount(0);
    expect((await page.request.get(`${GAME}/r/AAAAAAAAAAAAAAAAAAAAAAAA/card`)).status()).toBe(404);
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

  test("A5 再玩一次：換新的一局（同樣的路線、新的台詞抽籤）；R 重新開始同一局", async ({ page }) => {
    await enter(page);
    await playToFinal(page);
    await page.getByTestId("again-button").click();
    await expect(page.getByTestId("briefing")).toBeVisible();
    await expect.poll(async () => (await snap(page)).phase).toBe("briefing");
    await page.keyboard.press("Enter");
    await page.keyboard.press("r");
    await expect(page.getByTestId("briefing")).toBeVisible();
    expect((await snap(page)).tick).toBe(0);
  });
});

test.describe("聲音", () => {
  test("M10 M11 M12 音符鈕與喇叭鈕各自獨立、記在本機；暫停選單同步；音檔載入失敗照常可玩", async ({ page }) => {
    await enter(page);
    await expect(page.getByTestId("music-button")).toBeVisible();
    await expect(page.getByTestId("mute-button")).toBeVisible();
    const box = await page.getByTestId("mute-button").boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await page.getByTestId("mute-button").click();
    await expect.poll(() => page.evaluate(() => window.__officeEscapeSound!.state.muted)).toBe(true);
    expect(await page.evaluate(() => window.__officeEscapeSound!.state.musicOn)).toBe(true);
    await page.getByTestId("music-button").click();
    await expect.poll(() => page.evaluate(() => window.__officeEscapeSound!.state.musicOn)).toBe(false);
    // 焦點還在音符鈕上，Enter 會再按它一次；改點出發鈕
    await page.getByTestId("briefing").getByTestId("depart-button").click();
    await page.keyboard.press("p");
    await expect(page.getByTestId("sound-switch")).toHaveAttribute("aria-checked", "false");
    await expect(page.getByTestId("music-switch")).toHaveAttribute("aria-checked", "false");
    await page.getByTestId("sound-switch").click();
    await expect(page.getByTestId("sound-switch")).toHaveAttribute("aria-checked", "true");
    expect(await page.evaluate(() => window.__officeEscapeSound!.state.active)).toBe(false);
    await page.getByTestId("resume-button").click();
    await expect.poll(() => page.evaluate(() => window.__officeEscapeSound!.state.active)).toBe(true);
    // 重新整理後選擇還在
    await page.reload();
    await enter(page);
    expect(await page.evaluate(() => window.__officeEscapeSound!.state.musicOn)).toBe(false);
  });

  test("M2 M5 M6 動作對應的音效有送出（log）", async ({ page }) => {
    await enter(page);
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(250);
    await page.keyboard.press("ArrowUp");
    const log = await page.evaluate(() => window.__officeEscapeSound!.log.map((entry) => entry.name));
    expect(log).toEqual(expect.arrayContaining(["ui-click.mp3", "lane.mp3", "jump.mp3"]));
  });
});

test.describe("多語系與版面", () => {
  for (const [prefix, title] of [
    ["", "下班逃離辦公室"],
    ["/zh-cn", "下班逃离办公室"],
    ["/en", "Clock-Out Escape"],
    ["/ja", "退勤ダッシュ"],
    ["/ko", "퇴근 탈출"],
    ["/vi", "Tan ca thoát khỏi văn phòng"],
    ["/pt", "Fuga do Escritório"],
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
      await expect(page.getByTestId("briefing")).toBeVisible({ timeout: 30_000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      // 出發鈕與按鈕至少 44×44
      const box = await page.getByTestId("briefing").getByTestId("depart-button").boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    });
  }

  test("K6 越南文與葡文最長的畫面（段落介紹、事件、結算）沒有橫向溢出", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    for (const prefix of ["/vi", "/pt"]) {
      await enter(page, `${prefix}${GAME}`);
      await page.keyboard.press("Enter");
      await playToFinal(page);
      const overflow = await page.evaluate(() => {
        const frame = document.querySelector("[data-testid=final-panel]")!;
        return [...frame.querySelectorAll("*")].filter((el) => (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth + 1 && getComputedStyle(el).overflow === "visible" && (el as HTMLElement).clientWidth > 0 && el.children.length === 0 && (el as HTMLElement).scrollWidth > frame.clientWidth).length;
      });
      expect(overflow).toBe(0);
    }
  });
});

// ---- 帳號、訪客與排行榜 ----
const newBrowser = (browser: Browser, headers: Record<string, string> = {}) =>
  browser.newContext({ extraHTTPHeaders: { "cf-connecting-ip": randomIp(), ...headers } });

const best = (score: number, mode: "daily" | "all" = "all", at = Date.now() - 1000) => ({
  mode,
  dateKey: mode === "daily" ? today() : null,
  score,
  achievedAt: at,
});

async function postAsNew(context: BrowserContext | Page, bests: ReturnType<typeof best>[], extra: Record<string, unknown> = {}) {
  const syncId = `id-${unique()}`;
  const response = await context.request.post(`${RECORDS}/sync`, { headers: { Origin: ORIGIN }, data: { syncId, playerId: null, bests, ...extra } });
  return { response, syncId, body: (await response.json().catch(() => null)) as { daily?: Record<string, number>; best?: number | null; guest?: { playerId: string }; error?: string } | null };
}

const mine = async (context: BrowserContext, scope: string, player: string) =>
  (await context.request.get(`${LB}/me?scope=${scope}&player=${player}`)).json() as Promise<{ rank: number | null; score: number | null; total: number; toTop100: number | null }>;

test.describe("帳號紀錄與排行榜 API", () => {
  test("T1 T2 T5 T8 T18 P3 建立訪客上榜；取高分；每人一次；不帶個人資料；名次不快取", async ({ browser }) => {
    const [a, b] = await Promise.all([newBrowser(browser), newBrowser(browser)]);
    const first = await postAsNew(a, [best(7000), best(7000, "daily")]);
    expect(first.response.status()).toBe(200);
    expect(first.body?.best).toBe(7000);
    expect(first.body?.daily?.[today()]).toBe(7000);
    const cookie = (await a.cookies()).find((c) => c.name === "gs_guest")!;
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax" });
    const guestA = first.body!.guest!.playerId;

    // 同一個人再送較低的：不覆蓋；較高的：換上
    const sync = (context: BrowserContext, bests: ReturnType<typeof best>[], playerId: string) =>
      context.request.post(`${RECORDS}/sync`, { headers: { Origin: ORIGIN }, data: { syncId: `id-${unique()}`, playerId, bests } });
    expect(((await (await sync(a, [best(100)], guestA)).json()) as { best: number }).best).toBe(7000);
    expect(((await (await sync(a, [best(8000)], guestA)).json()) as { best: number }).best).toBe(8000);

    const second = await postAsNew(b, [best(8000)]);
    const guestB = second.body!.guest!.playerId;
    // 同分：先創下的在前（A 的 8000 比 B 晚創下，所以 B 在 A 前面，或同一毫秒時由玩家 ID 決定）
    const [ra, rb] = [await mine(a, "all", guestA), await mine(b, "all", guestB)];
    expect(ra.score).toBe(8000);
    expect(rb.score).toBe(8000);
    expect(ra.rank).not.toBe(rb.rank);

    const top = await (await a.request.get(`${LB}?scope=all`)).json();
    expect(top.rows.length).toBeGreaterThan(0);
    expect(Object.keys(top.rows[0]).sort()).toEqual(["achievedAt", "color", "guest", "nick", "rank", "score"]);
    expect(JSON.stringify(top)).not.toContain(guestA);
    const response = await a.request.get(`${LB}/me?scope=all&player=${guestA}`);
    expect(response.headers()["cache-control"]).toContain("no-store");
    await Promise.all([a.close(), b.close()]);
  });

  test("P2 P5 沒有身分 401；格式或分數不對 400 且不寫入；身分不同 409；跨站請求 403；超過 8 KB 被拒", async ({ browser }) => {
    const context = await newBrowser(browser);
    expect((await context.request.get(RECORDS)).status()).toBe(401);
    const bad = await postAsNew(context, [best(1_000_000)]);
    expect(bad.response.status()).toBe(400);
    expect((await postAsNew(context, [{ ...best(5), mode: "free" as never }])).response.status()).toBe(400);
    expect((await context.cookies()).find((c) => c.name === "gs_guest")).toBeUndefined();
    const ok = await postAsNew(context, [best(500)]);
    expect(ok.response.status()).toBe(200);
    const wrong = await context.request.post(`${RECORDS}/sync`, { headers: { Origin: ORIGIN }, data: { syncId: `id-${unique()}`, playerId: "someone-else", bests: [best(600)] } });
    expect(wrong.status()).toBe(409);
    expect((await context.request.get(`${RECORDS}?player=someone-else`)).status()).toBe(409);
    expect((await context.request.get(`${LB}/me?scope=all&player=someone-else`)).status()).toBe(409);
    const cross = await context.request.post(`${RECORDS}/sync`, { headers: { Origin: "https://evil.example" }, data: { syncId: `id-${unique()}`, playerId: ok.body!.guest!.playerId, bests: [best(1)] } });
    expect(cross.status()).toBe(403);
    const big = await context.request.post(`${RECORDS}/sync`, { headers: { Origin: ORIGIN, "Content-Type": "application/json" }, data: JSON.stringify({ pad: "x".repeat(9000) }) });
    expect([400, 413]).toContain(big.status());
    expect((await context.request.get(`${LB}?scope=free`)).status()).toBe(400);
    await context.close();
  });

  test("T9 回應掉了、用同一個 syncId 重送：找回同一個訪客、補發 cookie，不重複建立", async ({ browser }) => {
    const context = await newBrowser(browser);
    const first = await postAsNew(context, [best(700)]);
    const guest = first.body!.guest!.playerId;
    await context.clearCookies();
    const again = await context.request.post(`${RECORDS}/sync`, { headers: { Origin: ORIGIN }, data: { syncId: first.syncId, playerId: null, bests: [best(700)] } });
    expect(again.status()).toBe(200);
    expect(((await again.json()) as { guest: { playerId: string } }).guest.playerId).toBe(guest);
    expect((await context.cookies()).find((c) => c.name === "gs_guest")).toBeTruthy();
    await context.close();
  });

  test("T10 同一個 IP 每分鐘最多建立 3 個訪客，第 4 個回 429", async ({ browser }) => {
    const ip = randomIp();
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      const context = await newBrowser(browser, { "cf-connecting-ip": ip });
      statuses.push((await postAsNew(context, [best(10 + i)])).response.status());
      await context.close();
    }
    expect(statuses.slice(0, 3)).toEqual([200, 200, 200]);
    expect(statuses[3]).toBe(429);
  });

  test("T11 歐盟地區：沒帶同意回 403 consent_required，帶了才建立訪客；/api/me 回 consentRequired", async ({ browser }) => {
    const context = await newBrowser(browser, { "cf-ipcountry": "DE" });
    expect((await (await context.request.get("/api/me")).json()).consentRequired).toBe(true);
    const refused = await postAsNew(context, [best(900)]);
    expect(refused.response.status()).toBe(403);
    expect(refused.body?.error).toBe("consent_required");
    expect((await context.cookies()).find((c) => c.name === "gs_guest")).toBeUndefined();
    const allowed = await postAsNew(context, [best(900)], { consent: true });
    expect(allowed.response.status()).toBe(200);
    await context.close();
  });

  test("T15 T23 刪除訪客：跨站請求被擋、身分不同 409；成功後 cookie 清掉、榜上沒有", async ({ browser }) => {
    const context = await newBrowser(browser);
    const created = await postAsNew(context, [best(1234)]);
    const guest = created.body!.guest!.playerId;
    expect((await context.request.delete("/api/guest", { headers: { Origin: "https://evil.example" } })).status()).toBe(403);
    expect((await context.request.delete("/api/guest?player=other", { headers: { Origin: ORIGIN } })).status()).toBe(409);
    expect((await context.request.delete(`/api/guest?player=${guest}`, { headers: { Origin: ORIGIN } })).status()).toBe(200);
    expect((await context.cookies()).find((c) => c.name === "gs_guest")).toBeUndefined();
    const after = await context.request.get(`${LB}/me?scope=all&player=${guest}`);
    expect(after.status()).toBe(401);
    await context.close();
  });
});

test.describe("玩完一局：訪客上榜、登入併入", () => {
  test("P17 T8 只看介紹頁不呼叫紀錄 API；玩完一局才送出，建立訪客，結算後榜上看得到自己", async ({ page, context }) => {
    const calls: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/games/office-escape/records")) calls.push(request.method());
    });
    await page.goto(GAME);
    await page.waitForTimeout(800);
    expect(calls).toEqual([]);
    await page.getByTestId("depart-button").first().click();
    await expect(page.getByTestId("briefing")).toBeVisible({ timeout: 30_000 });
    await playToFinal(page);
    await expect.poll(async () => (await context.cookies()).find((c) => c.name === "gs_guest") !== undefined, { timeout: 15_000 }).toBe(true);
    expect(calls).toContain("POST");
    const info = (await (await page.request.get("/api/me")).json()) as { guest?: { playerId: string } };
    const total = (await snap(page)).result!.total;
    await expect.poll(async () => (await mine(context, "all", info.guest!.playerId)).score, { timeout: 15_000 }).toBeGreaterThanOrEqual(total);
    // 回到介紹頁：全站排行分頁有「你的名次」，訪客標籤
    await page.getByTestId("back-to-intro-button").click();
    await expect(page.getByTestId("departure-board")).toBeVisible();
    await page.getByTestId("rank-tab").click();
    await expect(page.getByTestId("leaderboard")).toBeVisible();
    await expect(page.getByTestId("rank-mine")).toHaveAttribute("data-kind", "ranked", { timeout: 15_000 });
    await expect(page.getByTestId("rank-mine").getByTestId("guest-badge")).toBeVisible();
    await expect(page.getByTestId("rank-row").first()).toBeVisible();
    for (const scope of ["daily", "week", "all"]) {
      await page.getByTestId(`rank-scope-${scope}`).click();
      await expect(page.getByTestId("rank-updated").or(page.getByTestId("rank-empty")).first()).toBeAttached();
    }
  });

  test("T7 讀不到前 100 名：顯示「暫時讀不到排行」、不自動重試，按「再試一次」恢復", async ({ page }) => {
    let count = 0;
    await page.route("**/api/games/office-escape/leaderboard?**", (route) => {
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

  test("P6 P7 T13 訪客用 Google 登入：兩款遊戲的紀錄併進帳號、gs_guest 清掉；換裝置登入看得到；登出清掉本機", async ({ browser }) => {
    const context = await newBrowser(browser);
    const page = await hydratedPage(context);
    await enter(page);
    await playToFinal(page);
    const total = (await snap(page)).result!.total;
    await expect.poll(async () => (await context.cookies()).find((c) => c.name === "gs_guest") !== undefined, { timeout: 15_000 }).toBe(true);
    await page.getByTestId("back-to-intro-button").click();
    const sub = `e2e-oe-${unique()}`;
    await context.addCookies([{ name: "fake_sub", value: sub, domain: "localhost", path: "/" }]);
    await page.getByTestId("login-button").first().click();
    await expect(page.getByTestId("banner-ok")).toBeVisible();
    expect((await context.cookies()).find((c) => c.name === "gs_guest")).toBeUndefined();
    const account = (await (await context.request.get(RECORDS)).json()) as { best: number };
    expect(account.best).toBeGreaterThanOrEqual(total);
    await expect(page.getByTestId("record-all")).toHaveText(new RegExp(String(account.best).replace(/\B(?=(\d{3})+(?!\d))/g, ",")));

    // B 裝置登入同一個帳號：紀錄卡看得到
    const other = await newBrowser(browser);
    await other.addCookies([{ name: "fake_sub", value: sub, domain: "localhost", path: "/" }]);
    const pageB = await hydratedPage(other);
    await pageB.goto(GAME);
    await pageB.getByTestId("login-button").first().click();
    await expect(pageB.getByTestId("banner-ok")).toBeVisible();
    await expect(pageB.getByTestId("record-all")).toHaveText(new RegExp(String(account.best).replace(/\B(?=(\d{3})+(?!\d))/g, ",")));

    // /me 的最佳紀錄也有下班逃離辦公室
    await pageB.goto("/me");
    await expect(pageB.getByTestId("me-bests-office-escape")).toBeVisible();
    await expect(pageB.getByTestId("me-escape-best")).not.toHaveText("—");

    // 登出：本機紀錄清空
    await page.goto("/me");
    await page.getByRole("button", { name: "登出" }).click();
    await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{"best":null}').best, LOCAL), { timeout: 15_000 }).toBeNull();
    await Promise.all([context.close(), other.close()]);
  });

  test("P9 P10 送不出去：成績留在本機，網路恢復後再送，成功後榜上有這筆", async ({ browser }) => {
    const context = await newBrowser(browser);
    const page = await hydratedPage(context);
    let block = true;
    await page.route("**/api/games/office-escape/records/sync", (route) => (block ? route.abort() : route.continue()));
    await enter(page);
    await playToFinal(page);
    const total = (await snap(page)).result!.total;
    await expect(page.getByTestId("record-note")).toBeVisible();
    expect((await context.cookies()).find((c) => c.name === "gs_guest")).toBeUndefined();
    block = false;
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect.poll(async () => (await context.cookies()).find((c) => c.name === "gs_guest") !== undefined, { timeout: 20_000 }).toBe(true);
    const info = (await (await page.request.get("/api/me")).json()) as { guest: { playerId: string } };
    await expect.poll(async () => (await mine(context, "all", info.guest.playerId)).score, { timeout: 15_000 }).toBeGreaterThanOrEqual(total);
    await context.close();
  });
});

// ---- 補齊驗收條目 ----
test.describe("補充：操作、特效與錯誤處理", () => {
  test("E3 突發事件按 2 選第二個選項，事件關閉並計分；E5 長按不跳右鍵選單", async ({ page }) => {
    await enter(page);
    await page.evaluate(() => {
      const s = window.__officeEscape.session;
      s.depart();
      s.sim.z = 46 - 0.3;
    });
    await expect(page.getByTestId("event-dialog")).toBeVisible({ timeout: 30_000 });
    const before = await snap(page);
    await page.keyboard.press("2");
    await expect(page.getByTestId("event-dialog")).toHaveCount(0);
    const after = await snap(page);
    expect(after.event).toBeNull();
    expect([0, 100, 300]).toContain(after.score - before.score);
    const prevented = await page.evaluate(() => {
      const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
      document.querySelector("[data-testid=game-frame]")!.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(prevented).toBe(true);
  });

  test("G6 減少動態效果：突發事件不放慢", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await enter(page);
    await page.evaluate(() => {
      const s = window.__officeEscape.session;
      s.depart();
      s.sim.z = 46 - 0.3;
    });
    await expect(page.getByTestId("event-dialog")).toBeVisible({ timeout: 30_000 });
    const z0 = await page.evaluate(() => window.__officeEscape.session.sim.z);
    await page.waitForTimeout(600);
    const z1 = await page.evaluate(() => window.__officeEscape.session.sim.z);
    // 不放慢：0.6 秒至少走 2 公尺（放慢到 20% 只會走不到 0.8 公尺）
    expect(z1 - z0).toBeGreaterThan(2);
  });

  test("F9 F10 加班結局：被主管攔下顯示「差 N 秒」和 ×1.0，沒有稱號；準時下班 ×1.5", async ({ page }) => {
    await enter(page);
    await page.evaluate(() => {
      const s = window.__officeEscape.session;
      s.depart();
      s.sim.tick = 90 * 120 - 5;
    });
    await expect(page.getByTestId("final-panel")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("final-panel")).toHaveAttribute("data-ending", "overtime");
    await expect(page.getByTestId("ending-line")).toContainText("差");
    await expect(page.getByTestId("ending-line")).toContainText("×1.0");
    await expect(page.getByTestId("final-panel")).not.toContainText("稱號");
    await page.getByTestId("again-button").click();
    await expect(page.getByTestId("briefing")).toBeVisible();
    await page.evaluate(() => {
      const s = window.__officeEscape.session;
      s.depart();
      // 時鐘先走了 10 秒：之後的乾淨一局大約 66 秒出門，落在準時下班（60–90 秒）
      s.sim.tick = 10 * 120;
    });
    await playToFinal(page);
    await expect(page.getByTestId("final-panel")).toHaveAttribute("data-ending", /ontime|hidden/);
    await expect(page.getByTestId("ending-line")).toContainText("×1.5");
  });

  test("G7 H7 結算後粒子不超過 60；重複進出遊戲 6 次不累積 WebGL，主控台沒有警告", async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto(GAME);
    for (let i = 0; i < 6; i++) {
      await page.getByTestId("depart-button").first().click();
      await expect(page.getByTestId("briefing")).toBeVisible({ timeout: 30_000 });
      await page.goBack();
      await expect(page.getByTestId("departure-board")).toBeVisible();
      await expect(page.getByTestId("game-stage")).toHaveCount(0);
    }
    await enter(page);
    await playToFinal(page);
    const particles = await page.evaluate(() => (window.__officeEscape as unknown as { scene: { particles: number } }).scene.particles);
    expect(particles).toBeLessThanOrEqual(60);
    expect(problems.filter((p) => /WebGL|context/i.test(p))).toEqual([]);
  });

  test("H9 N6 WebGL 建立失敗：顯示錯誤訊息和重試按鈕，不白畫面", async ({ page }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        if (/webgl/.test(type)) return null;
        return (original as (...args: unknown[]) => unknown).call(this, type, ...rest) as never;
      } as never;
    });
    await page.goto(GAME);
    await page.getByTestId("depart-button").first().click();
    await expect(page.getByTestId("game-error")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("game-error").getByRole("button")).toBeVisible();
  });

  test("N2 N3 遊戲畫面上所有按鈕至少 44×44，圖示鈕有無障礙名稱", async ({ page }) => {
    await enter(page);
    await page.keyboard.press("Enter");
    for (const button of await page.locator("[data-testid=game-stage] button").all()) {
      if (!(await button.isVisible())) continue;
      const box = (await button.boundingBox())!;
      expect(box.width, await button.innerHTML()).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      const name = ((await button.getAttribute("aria-label")) ?? (await button.innerText())).trim();
      expect(name).not.toBe("");
    }
  });

  test("J5 J6 手機有系統分享選單時用它；電腦有 LINE、Facebook、X、下載、複製連結", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __shared: unknown[] }).__shared = [];
      navigator.canShare = () => true;
      navigator.share = async (data?: ShareData) => {
        (window as unknown as { __shared: unknown[] }).__shared.push({ text: data?.text, url: data?.url, files: data?.files?.length });
      };
    });
    await enter(page);
    await playToFinal(page);
    await page.getByTestId("share-button").click();
    await expect(page.getByTestId("share-card")).toBeVisible({ timeout: 30_000 });
    for (const id of ["share-native", "share-copy", "share-download"]) await expect(page.getByTestId(id)).toBeVisible();
    await page.getByTestId("share-native").click();
    const shared = await page.evaluate(() => (window as unknown as { __shared: { text: string; url: string; files: number }[] }).__shared);
    expect(shared).toHaveLength(1);
    expect(shared[0].files).toBe(1);
    expect(shared[0].url).toContain("/games/office-escape/r/");
    expect(shared[0].text).toMatch(/下班逃離辦公室/);
    if ((page.viewportSize()?.width ?? 0) >= 768) for (const id of ["share-line", "share-facebook", "share-x"]) await expect(page.getByTestId(id)).toBeVisible();
  });

  test("K2 語言選單：切換後留在同一頁", async ({ page }) => {
    await page.goto(GAME);
    await expect(page.getByTestId("language-button")).toHaveCount(1);
    await page.getByTestId("language-button").click();
    await page.getByRole("dialog").getByRole("link", { name: "English" }).click();
    await expect(page).toHaveURL(`/en${GAME}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Clock-Out Escape");
  });

  test("L2 累計遊玩次數預設不顯示", async ({ page }) => {
    await page.goto(GAME);
    await expect(page.getByTestId("play-count")).toHaveCount(0);
  });

  test("F2 前方 2 秒內有障礙時，畫面邊緣出現提示", async ({ page }) => {
    await enter(page);
    await page.evaluate(() => {
      const s = window.__officeEscape.session;
      s.depart();
      // 第 1 段第一排障礙前面一點
      s.sim.z = 8;
    });
    await expect(page.getByTestId("hud-warning").first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("補充：帳號、排行榜", () => {
  test("T3 前 10 名、展開到更多名次；前三名有名次牌", async ({ browser, page }) => {
    for (let i = 0; i < 12; i++) {
      const context = await newBrowser(browser);
      await postAsNew(context, [best(9000 + i)]);
      await context.close();
    }
    await page.goto(GAME);
    await page.getByTestId("rank-tab").click();
    await page.getByTestId("rank-scope-all").click();
    await expect(page.getByTestId("rank-row")).toHaveCount(10, { timeout: 15_000 });
    await page.getByTestId("rank-expand").click();
    expect(await page.getByTestId("rank-row").count()).toBeGreaterThan(10);
    await expect(page.getByTestId("rank-mine")).toHaveAttribute("data-kind", "join");
  });

  test("P5 同一人每分鐘超過 30 次同步回 429", async ({ browser }) => {
    const context = await newBrowser(browser);
    const created = await postAsNew(context, [best(100)]);
    const guest = created.body!.guest!.playerId;
    const codes: number[] = [];
    for (let i = 0; i < 33; i++) {
      const response = await context.request.post(`${RECORDS}/sync`, { headers: { Origin: ORIGIN }, data: { syncId: `id-${unique()}`, playerId: guest, bests: [best(100 + i)] } });
      codes.push(response.status());
    }
    expect(codes).toContain(429);
    await context.close();
  });

  test("P10 登出提醒：有沒送出的成績才提醒，焦點在「先不要登出」", async ({ browser }) => {
    const context = await newBrowser(browser);
    const page = await hydratedPage(context);
    await context.addCookies([{ name: "fake_sub", value: `e2e-oe-${unique()}`, domain: "localhost", path: "/" }]);
    await page.goto("/me");
    await page.getByTestId("login-button").first().click();
    await expect(page.getByTestId("banner-ok")).toBeVisible();
    await context.route("**/api/games/office-escape/records/sync", (route) => route.abort());
    await page.goto(GAME);
    await page.getByTestId("depart-button").first().click();
    await expect(page.getByTestId("briefing")).toBeVisible({ timeout: 30_000 });
    await playToFinal(page);
    await page.goto("/me");
    await page.getByRole("button", { name: "登出" }).click();
    const dialog = page.getByTestId("logout-pending");
    await expect(dialog).toContainText("還有成績沒存到帳號");
    await expect(dialog.getByRole("button", { name: "先不要登出" })).toBeFocused();
    await dialog.getByRole("button", { name: "先不要登出" }).click();
    await expect(page.getByTestId("me-account")).toContainText("已用 Google 登入");
    await context.close();
  });

  test("P12 登入過期（401）不清本機紀錄，下次登入時併進帳號", async ({ browser }) => {
    const context = await newBrowser(browser);
    const page = await hydratedPage(context);
    const sub = `e2e-oe-${unique()}`;
    await context.addCookies([{ name: "fake_sub", value: sub, domain: "localhost", path: "/" }]);
    await page.goto(GAME);
    await page.getByTestId("login-button").first().click();
    await expect(page.getByTestId("banner-ok")).toBeVisible();
    // 只刪伺服器認得的登入 cookie：頁面還以為登入中
    await context.clearCookies({ name: "gs_session" });
    await page.getByTestId("depart-button").first().click();
    await expect(page.getByTestId("briefing")).toBeVisible({ timeout: 30_000 });
    await playToFinal(page);
    const total = (await snap(page)).result!.total;
    await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{"best":null}').best, LOCAL), { timeout: 15_000 }).toBe(total);
    await page.getByTestId("back-to-intro-button").click();
    await expect(page.getByTestId("login-hint")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("login-button").first().click();
    await expect(page.getByTestId("banner-ok")).toBeVisible();
    await expect.poll(async () => ((await (await context.request.get(RECORDS)).json()) as { best: number }).best, { timeout: 15_000 }).toBeGreaterThanOrEqual(total);
    await context.close();
  });
});
