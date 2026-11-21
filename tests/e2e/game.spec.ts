import { expect, test } from "./fixtures";
import { GAME, depart, enterGame, playToFinal, setAutopilot, snapshot, watchConsole } from "./helpers";

test("I2 介紹頁的內容齊全，今日路線預覽和實際路線一致", async ({ page, isMobile }) => {
  await page.goto(GAME);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("精準停車");
  await expect(page.getByTestId("departure-board")).toBeVisible();
  for (const mode of ["daily", "free"]) {
    await expect(page.getByTestId(`depart-${mode}`)).toBeVisible();
    // 手機的「我的最佳」併在模式說明那一行
    if (!isMobile) await expect(page.getByTestId(`best-${mode}`)).toBeVisible();
  }
  await expect(page.getByTestId("records-card")).toBeVisible();
  for (const id of ["howto-title", "scoring-title", "faq-title"]) await expect(page.locator(`#${id}`)).toBeVisible();
  // 路線預覽在瀏覽器端接手後才排好；allInnerTexts 不會自動等待，先等 5 站出現
  const stations = page.getByTestId("departure-board").locator("[data-testid=route-strip]:visible > li");
  await expect(stations).toHaveCount(5);
  const preview = await stations.allInnerTexts();

  await page.getByTestId("depart-daily").click();
  await expect(page.getByTestId("briefing")).toBeVisible({ timeout: 30_000 });
  const first = (await page.getByTestId("briefing-station").innerText()).replace(/\s/g, "");
  expect(preview[0]).toContain(first);
});

test("I3 I4 I5 只有出發鈕能開始；整頁切換、網址不變；返回鍵和重新整理回介紹頁", async ({ page, isMobile }) => {
  await page.goto(GAME);
  await page.locator('main img[src*="hero"]').first().click({ force: true });
  await expect(page.getByTestId("game-stage")).toHaveCount(0);

  await page.getByTestId("depart-daily").click();
  await expect(page.getByTestId("briefing")).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(GAME);
  // 網站的頁首、說明、廣告、頁尾都收起來
  for (const selector of ["header", "footer", "[data-ad-slot]", "#howto-title"]) {
    await expect(page.locator(selector).first(), selector).toBeHidden();
  }

  await page.goBack();
  await expect(page.getByTestId("game-stage")).toHaveCount(0);
  await expect(page).toHaveURL(GAME);
  await expect(page.getByTestId("departure-board")).toBeVisible();

  await page.getByTestId(isMobile ? "depart-free" : "depart-daily").click();
  await expect(page.getByTestId("briefing")).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(page.getByTestId("departure-board")).toBeVisible();
  await expect(page.getByTestId("game-stage")).toHaveCount(0);
});

test("F1 F9 I6 J1 Q3 跑完 5 站到結算，紀錄留在本機，再玩一次和換模式", async ({ page }) => {
  const problems = watchConsole(page);
  await enterGame(page, "daily");
  await playToFinal(page);

  const total = Number(await page.getByTestId("final-total").getAttribute("data-total"));
  expect(total).toBeGreaterThan(3000);
  await expect(page.getByTestId("final-panel").locator("ol > li")).toHaveCount(5);
  await expect(page.getByTestId("record-note")).toHaveAttribute("data-new-record", "true");
  for (const id of ["share-button", "again-button", "change-mode-button"]) await expect(page.getByTestId(id)).toBeVisible();

  // 再玩一次：同一模式回到第 1 站的介紹
  await page.getByTestId("again-button").click();
  await expect(page.getByTestId("briefing")).toBeVisible();
  expect((await snapshot(page)).index).toBe(0);
  expect((await snapshot(page)).total).toBe(0);

  // 換模式（要先跑到結算）改用暫停選單的「回到遊戲介紹」驗證同一條路
  await depart(page);
  await page.keyboard.press("p");
  await expect(page.getByTestId("pause-dialog")).toBeVisible();
  await page.getByTestId("pause-dialog").getByRole("button").last().click();
  await expect(page.getByTestId("game-stage")).toHaveCount(0);
  await expect(page.getByTestId("departure-board")).toBeVisible();

  const best = total.toLocaleString("zh-TW");
  await expect(page.getByTestId("best-daily")).toContainText(best);
  await expect(page.getByTestId("best-free")).not.toContainText(best);
  await page.reload();
  await expect(page.getByTestId("best-daily")).toContainText(best);
  expect(problems).toEqual([]);
});

test("I6 結算的換模式回到介紹頁的出發看板", async ({ page }) => {
  await enterGame(page, "free");
  await playToFinal(page);
  await page.getByTestId("change-mode-button").click();
  await expect(page.getByTestId("game-stage")).toHaveCount(0);
  await expect(page.getByTestId("departure-board")).toBeInViewport();
  await expect(page).toHaveURL(GAME);
});

test("E2 E4 鍵盤：空白鍵與 ↓ 煞車、Enter 出發、P／Esc 暫停、R 重新開始，不捲動頁面", async ({ page, isMobile }) => {
  test.skip(isMobile, "鍵盤操作只測電腦");
  await enterGame(page);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("game-stage")).toHaveAttribute("data-phase", "running");

  for (const key of ["Space", "ArrowDown"]) {
    await page.keyboard.down(key);
    await expect.poll(async () => (await snapshot(page)).train.brake).toBeGreaterThan(0.9);
    expect((await snapshot(page)).braking).toBe(true);
    await page.keyboard.up(key);
    await expect.poll(async () => (await snapshot(page)).train.brake).toBe(0);
  }
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  await page.keyboard.press("p");
  await expect(page.getByTestId("pause-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("pause-dialog")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("pause-dialog")).toBeVisible();
  await page.keyboard.press("p");
  await expect(page.getByTestId("pause-dialog")).toHaveCount(0);

  await page.keyboard.press("r");
  await expect(page.getByTestId("briefing")).toBeVisible();
  // 空白鍵也能出發
  await page.keyboard.press("Space");
  await expect(page.getByTestId("game-stage")).toHaveAttribute("data-phase", "running");

  // 滑鼠左鍵按住煞車；右鍵選單被擋掉
  const frame = page.getByTestId("game-frame");
  const box = (await frame.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.3);
  await page.mouse.down();
  await expect.poll(async () => (await snapshot(page)).braking).toBe(true);
  await page.mouse.up();
  await expect.poll(async () => (await snapshot(page)).braking).toBe(false);
  const prevented = await frame.evaluate((element) => {
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(true);
  expect(await frame.evaluate((element) => getComputedStyle(element).userSelect)).toBe("none");
});

test("E1 觸控：按住任一處煞車，多指和滑出畫面都不會卡住", async ({ page }) => {
  await enterGame(page);
  await depart(page);
  const frame = page.getByTestId("game-frame");
  const fire = (type: string, pointerId: number) =>
    frame.evaluate(
      (element, [eventType, id]) => {
        const box = element.getBoundingClientRect();
        element.dispatchEvent(
          new PointerEvent(eventType as string, {
            pointerId: id as number,
            pointerType: "touch",
            isPrimary: id === 11,
            bubbles: true,
            cancelable: true,
            clientX: box.left + box.width / 2,
            clientY: box.top + box.height * 0.7,
          }),
        );
      },
      [type, pointerId] as const,
    );
  await fire("pointerdown", 11);
  await expect.poll(async () => (await snapshot(page)).braking).toBe(true);
  await fire("pointerdown", 12);
  await fire("pointerup", 11);
  expect((await snapshot(page)).braking).toBe(true);
  await fire("pointerup", 12);
  await expect.poll(async () => (await snapshot(page)).braking).toBe(false);
  // 手指滑出畫面被系統取消
  await fire("pointerdown", 13);
  await expect.poll(async () => (await snapshot(page)).braking).toBe(true);
  await fire("pointercancel", 13);
  await expect.poll(async () => (await snapshot(page)).braking).toBe(false);
  // 視窗失去焦點時也放開
  await fire("pointerdown", 14);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect.poll(async () => (await snapshot(page)).braking).toBe(false);
  expect(await frame.evaluate((element) => getComputedStyle(element).touchAction)).toBe("none");
});

test("E3 切換分頁自動暫停，繼續時煞車力歸零", async ({ page }) => {
  await enterGame(page);
  await depart(page);
  await page.keyboard.down("Space");
  await expect.poll(async () => (await snapshot(page)).train.brake).toBeGreaterThan(0.5);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByTestId("pause-dialog")).toBeVisible();
  await page.keyboard.up("Space");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  // 回到分頁不會自己繼續
  await expect(page.getByTestId("pause-dialog")).toBeVisible();
  const before = (await snapshot(page)).train.distance;
  await page.waitForTimeout(300);
  expect((await snapshot(page)).train.distance).toBe(before);
  await page.getByTestId("resume-button").click();
  const resumed = await snapshot(page);
  expect(resumed.paused).toBe(false);
  expect(resumed.train.brake).toBe(0);
});

test("F5 F6 F10 遠方提示、近站放大到公分、暫停選單", async ({ page }) => {
  await enterGame(page);
  await depart(page);
  await expect(page.getByTestId("target-hint")).toBeVisible();
  await expect(page.getByTestId("hud-distance")).toHaveText(/^\d+\.\d\s*m$/);

  await page.getByRole("button", { name: "暫停" }).first().click();
  const dialog = page.getByTestId("pause-dialog");
  await expect(dialog.getByRole("button")).toHaveText([/繼續/, /重新開始這局/, /回到遊戲介紹/]);
  await page.getByTestId("resume-button").click();

  await setAutopilot(page, 1);
  await expect.poll(async () => (await snapshot(page)).zoomed, { timeout: 60_000 }).toBe(true);
  await expect(page.getByTestId("target-hint")).toHaveCount(0);
  await expect(page.getByTestId("hud-distance")).toHaveText(/^\+?\d+\.\d\d\s*m$/);
  await expect(page.getByTestId("judged-panel")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("judgement-plate")).toBeVisible();
  // 判定面板的按鈕沒有被遊戲框切掉
  const fits = await page.evaluate(() => {
    const frame = document.querySelector("[data-testid=game-frame]")!.getBoundingClientRect();
    const button = document.querySelector("[data-testid=next-button]")!.getBoundingClientRect();
    return button.bottom <= frame.bottom && button.height >= 44;
  });
  expect(fits).toBe(true);
});

test("G6 過站：輕震一次，畫布還在，可以繼續玩", async ({ page }) => {
  await enterGame(page);
  await depart(page);
  await page.evaluate(() => { window.__preciseStop.session.timeScale = 6; });
  await expect(page.getByTestId("judged-panel")).toHaveAttribute("data-judgement", "miss", { timeout: 60_000 });
  await expect(page.getByTestId("scene")).toHaveAttribute("data-shakes", "1");
  await expect(page.getByTestId("scene").locator("canvas")).toHaveCount(1);
  await expect(page.getByTestId("station-score")).toHaveText("0");
  await page.getByTestId("next-button").click();
  await expect(page.getByTestId("briefing")).toBeVisible();
  expect((await snapshot(page)).index).toBe(1);
});

test.describe("G8 減少動態效果", () => {
  test.use({ reducedMotion: "reduce" });
  test("不震動、不出集中線和彩帶", async ({ page }) => {
    await enterGame(page);
    await depart(page);
    await setAutopilot(page, 2);
    await expect.poll(async () => (await snapshot(page)).zoomed, { timeout: 60_000 }).toBe(true);
    await expect(page.getByTestId("focus-lines")).toHaveCount(0);
    await expect(page.getByTestId("judged-panel")).toBeVisible({ timeout: 60_000 });
    const fx = await page.evaluate(() => window.__preciseStop.fx);
    expect(fx.confetti).toBe(0);

    await page.getByTestId("next-button").click();
    await depart(page);
    await page.evaluate(() => { window.__preciseStop.session.autopilot = false; window.__preciseStop.session.timeScale = 6; });
    await expect(page.getByTestId("judged-panel")).toHaveAttribute("data-judgement", "miss", { timeout: 60_000 });
    await expect(page.getByTestId("scene")).toHaveAttribute("data-shakes", "0");
  });
});

test("I7 手機：看板離開畫面後出現固定出發列，回到畫面時收起", async ({ page, isMobile }) => {
  test.skip(!isMobile, "固定出發列只有手機有");
  await page.goto(GAME);
  const bar = page.getByTestId("sticky-depart");
  await expect(bar).toBeHidden();
  await page.locator("#faq-title").scrollIntoViewIfNeeded();
  await expect(bar).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(bar).toBeHidden();
  await page.locator("#faq-title").scrollIntoViewIfNeeded();
  await bar.getByRole("button").first().click();
  await expect(page.getByTestId("briefing")).toBeVisible({ timeout: 30_000 });
});

test("J2 瀏覽器不允許儲存時照常能玩，只是不記錄", async ({ page }) => {
  await page.addInitScript(() => {
    const deny = () => {
      throw new DOMException("denied", "SecurityError");
    };
    Storage.prototype.setItem = deny;
    Storage.prototype.getItem = deny;
  });
  await enterGame(page, "free");
  await playToFinal(page);
  await expect(page.getByTestId("not-saved")).toBeVisible();
  await expect(page.getByTestId("final-total")).not.toHaveAttribute("data-total", "0");
});

test("J5 J6 J7 分享：電腦有五個按鈕，手機支援時用系統分享；成績連結打得開", async ({ page, isMobile, request }) => {
  await page.addInitScript(() => {
    const calls: unknown[] = [];
    (window as unknown as { __shares: unknown[] }).__shares = calls;
    if (window.matchMedia("(pointer: coarse)").matches) {
      Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (data: ShareData) => {
          calls.push({ files: data.files?.length ?? 0, text: data.text, url: data.url });
        },
      });
    }
  });
  await enterGame(page, "daily");
  await playToFinal(page);
  await page.getByTestId("share-button").click();
  const card = page.getByTestId("share-card");
  await expect(card).toBeVisible({ timeout: 60_000 });
  const size = await card.evaluate(async (image: HTMLImageElement) => {
    await image.decode();
    return [image.naturalWidth, image.naturalHeight];
  });
  expect(size).toEqual([1080, 1350]);

  if (isMobile) {
    await page.getByTestId("share-native").click();
    const shares = await page.evaluate(() => (window as unknown as { __shares: { files: number; text: string; url: string }[] }).__shares);
    expect(shares).toHaveLength(1);
    expect(shares[0].files).toBe(1);
    expect(shares[0].text).toContain("精準停車");
    expect(shares[0].url).toContain(`${GAME}/r/`);
  } else {
    for (const id of ["share-line", "share-facebook", "share-x", "share-download", "share-copy"]) {
      await expect(page.getByTestId(id), id).toBeVisible();
    }
    await expect(page.getByTestId("share-native")).toHaveCount(0);
  }

  // 成績連結
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => undefined);
  const link = isMobile
    ? await page.evaluate(() => (window as unknown as { __shares: { url: string }[] }).__shares[0].url)
    : await (async () => {
        await page.getByTestId("share-copy").click();
        return page.evaluate(() => navigator.clipboard.readText());
      })();
  const path = new URL(link).pathname;
  expect(path).toMatch(/^\/games\/precise-stop\/r\/[A-Za-z0-9_-]+$/);

  const cardResponse = await request.get(`${path}/card`);
  expect(cardResponse.status()).toBe(200);
  expect(cardResponse.headers()["content-type"]).toContain("image/png");

  await page.goto(path);
  await expect(page.getByTestId("shared-banner")).toBeVisible();
  await expect(page.getByTestId("departure-board")).toBeVisible();
  await expect(page.getByTestId("game-stage")).toHaveCount(0);
  const og = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(og).toContain(`${path}/card`);

  // 亂改的代碼不會讓網站出錯
  for (const bad of ["zzzz", "AAAA", "%E4%B8%AD", "a".repeat(64)]) {
    const response = await request.get(`${GAME}/r/${bad}`);
    expect(response.status(), bad).toBeLessThan(500);
  }
  await page.goto(`${GAME}/r/zzzz`);
  await expect(page.getByTestId("departure-board")).toBeVisible();
  await expect(page.getByTestId("shared-banner")).toHaveCount(0);
});

test("N2 遊戲畫面的按鈕至少 44 px，都有名稱", async ({ page }) => {
  await enterGame(page);
  await depart(page);
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-game-stage] button")]
      .map((button) => ({ box: button.getBoundingClientRect(), name: (button.getAttribute("aria-label") ?? button.innerText).trim() }))
      .filter(({ box }) => box.width > 0)
      .filter(({ box, name }) => !name || box.width < 44 || box.height < 44)
      .map(({ box, name }) => `${name || "(沒有名稱)"} ${Math.round(box.width)}×${Math.round(box.height)}`),
  );
  expect(small).toEqual([]);
});

test("N5 介紹頁不載入 Phaser，按出發才載入", async ({ page }) => {
  const scripts: string[] = [];
  page.on("response", async (response) => {
    if (response.request().resourceType() !== "script") return;
    const body = await response.text().catch(() => "");
    if (body.includes("Phaser.Game") || body.includes("phaser/")) scripts.push(response.url());
  });
  await page.goto(GAME);
  await page.waitForLoadState("networkidle");
  expect(scripts).toEqual([]);
  await page.getByTestId("depart-daily").click();
  await expect(page.getByTestId("briefing")).toBeVisible({ timeout: 30_000 });
  expect(scripts.length).toBeGreaterThan(0);
});

test("N6 遊戲圖片載入失敗時顯示錯誤和重試，重試後能玩", async ({ page }) => {
  let blocked = true;
  await page.route("**/games/precise-stop/0.1.0/train-body.webp", (route) =>
    blocked ? route.abort() : route.continue(),
  );
  await page.goto(GAME);
  await page.getByTestId("depart-daily").click();
  const error = page.getByTestId("game-error");
  await expect(error).toBeVisible({ timeout: 30_000 });
  blocked = false;
  await error.getByRole("button").first().click();
  await expect(page.getByTestId("briefing")).toBeVisible({ timeout: 30_000 });
});
