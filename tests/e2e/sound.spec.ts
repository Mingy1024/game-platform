import { expect, test, type Page } from "@playwright/test";
import {
  GAME,
  depart,
  enterGame,
  playToFinal,
  setAutopilot,
  snapshot,
  soundLog,
  soundState,
  watchConsole,
} from "./helpers";

const SFX = "/games/precise-stop/0.1.0/sfx/";

async function waitLoaded(page: Page, count = 12) {
  await expect.poll(async () => (await soundState(page)).loaded, { timeout: 30_000 }).toBe(count);
}

test("R9 介紹頁不出聲、不載入音檔；按出發後才載入，沒有自動播放警告", async ({ page }) => {
  const problems = watchConsole(page);
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes(SFX)) requests.push(request.url());
  });
  await page.addInitScript(() => {
    const Original = window.AudioContext;
    (window as unknown as { __contexts: number }).__contexts = 0;
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) {
        super(options);
        (window as unknown as { __contexts: number }).__contexts += 1;
      }
    };
  });
  await page.goto(GAME);
  await page.waitForLoadState("networkidle");
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as { __contexts: number }).__contexts)).toBe(0);

  await page.getByTestId("depart-daily").click();
  await expect(page.getByTestId("briefing")).toBeVisible({ timeout: 30_000 });
  await waitLoaded(page);
  // 開發模式的 Strict Mode 會把 effect 跑兩次，所以只比對不同的檔案
  expect(new Set(requests).size).toBe(12);
  expect((await soundState(page)).context).toBe("running");
  expect(problems.filter((line) => /AudioContext|autoplay/i.test(line))).toEqual([]);
});

test("R1 R2 行駛聲隨車速、煞車聲隨煞車力；停住時淡出，停穩播停車聲", async ({ page }) => {
  await enterGame(page);
  await waitLoaded(page);
  await depart(page);
  await expect.poll(async () => (await soundState(page)).runGain, { timeout: 5_000 }).toBeGreaterThan(0.25);
  const fast = await soundState(page);
  expect(fast.brakeGain).toBeLessThan(0.02);

  await page.keyboard.down("Space");
  await expect.poll(async () => (await soundState(page)).brakeGain).toBeGreaterThan(0.3);
  await page.waitForTimeout(1500);
  const slower = await soundState(page);
  // 減速後音高降低
  expect(slower.runRate).toBeLessThan(fast.runRate);
  await page.keyboard.up("Space");
  await expect.poll(async () => (await soundState(page)).brakeGain).toBeLessThan(0.02);

  await setAutopilot(page, 4);
  await expect(page.getByTestId("judged-panel")).toBeVisible({ timeout: 60_000 });
  await expect.poll(async () => (await soundState(page)).runGain).toBeLessThan(0.01);
  expect(await soundLog(page)).toContain("stop.mp3");
});

test("R3 R4 剩 5 m 提示音和特效同時出現；判定音對應判定", async ({ page }) => {
  await enterGame(page);
  await waitLoaded(page);
  await depart(page);
  await setAutopilot(page, 1);
  await expect(page.getByTestId("zoom-plate")).toBeVisible({ timeout: 60_000 });
  expect(await soundLog(page)).toContain("final-5m.mp3");
  await page.evaluate(() => { window.__preciseStop.session.timeScale = 4; });
  const panel = page.getByTestId("judged-panel");
  await expect(panel).toBeVisible({ timeout: 60_000 });
  const judgement = await panel.getAttribute("data-judgement");
  expect((await soundLog(page)).at(-1)).toBe(`judge-${judgement}.mp3`);

  // 過站：失誤音
  await page.getByTestId("next-button").click();
  await depart(page);
  await page.evaluate(() => {
    window.__preciseStop.session.autopilot = false;
    window.__preciseStop.session.timeScale = 6;
  });
  await expect(panel).toHaveAttribute("data-judgement", "miss", { timeout: 60_000 });
  expect((await soundLog(page)).at(-1)).toBe("judge-miss.mp3");
});

test("R5 出發有點擊音；結算有跑分音，第一次就是新紀錄；結算按鈕有點擊音", async ({ page }) => {
  await enterGame(page, "free");
  await waitLoaded(page);
  await depart(page);
  expect(await soundLog(page)).toEqual(["ui-click.mp3"]);
  await setAutopilot(page, 10);
  await expect(page.getByTestId("judged-panel")).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("next-button").click();
  for (let station = 1; station < 5; station++) {
    await depart(page);
    await setAutopilot(page, 10);
    await expect(page.getByTestId("judged-panel")).toBeVisible({ timeout: 60_000 });
    await page.getByTestId("next-button").click();
  }
  await expect(page.getByTestId("final-panel")).toBeVisible();
  await expect(page.getByTestId("record-note")).toHaveAttribute("data-new-record", "true");
  const log = await soundLog(page);
  expect(log.filter((name) => name === "score-tick.mp3").length).toBeGreaterThanOrEqual(10);
  expect(log.at(-1)).toBe("new-record.mp3");

  await page.getByTestId("share-button").click();
  expect((await soundLog(page)).at(-1)).toBe("ui-click.mp3");
});

test("R6 靜音鈕在暫停鈕左邊，44 px 以上；暫停選單的開關同步", async ({ page }) => {
  await enterGame(page);
  await waitLoaded(page);
  await depart(page);
  const mute = page.getByTestId("mute-button");
  await expect(mute).toHaveAttribute("aria-label", "關閉音效");
  await expect(mute).toHaveAttribute("aria-pressed", "false");
  const pause = page.getByTestId("scene").getByRole("button", { name: "暫停" });
  const [muteBox, pauseBox, frame] = await Promise.all([
    mute.boundingBox(),
    pause.boundingBox(),
    page.getByTestId("game-frame").boundingBox(),
  ]);
  expect(muteBox!.width).toBeGreaterThanOrEqual(44);
  expect(muteBox!.height).toBeGreaterThanOrEqual(44);
  // 右上：暫停鈕左邊、同一列
  expect(muteBox!.x + muteBox!.width).toBeLessThanOrEqual(pauseBox!.x);
  expect(Math.abs(muteBox!.y - pauseBox!.y)).toBeLessThan(2);
  expect(muteBox!.y - frame!.y).toBeLessThan(frame!.height / 4);
  expect(muteBox!.x).toBeGreaterThan(frame!.x + frame!.width / 2);

  await mute.click();
  await expect(mute).toHaveAttribute("aria-pressed", "true");
  await expect(mute).toHaveAttribute("aria-label", "開啟音效");
  expect((await soundState(page)).muted).toBe(true);

  await pause.click();
  const toggle = page.getByTestId("sound-switch");
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("resume-button").click();
  await expect(mute).toHaveAttribute("aria-pressed", "false");
  expect((await soundState(page)).muted).toBe(false);
});

test("R6 七種語言的靜音鈕都有無障礙名稱", async ({ page }) => {
  const names: Record<string, [string, string]> = {
    "": ["關閉音效", "開啟音效"],
    "/zh-cn": ["关闭音效", "开启音效"],
    "/en": ["Mute sound", "Turn sound on"],
    "/ja": ["サウンドをオフ", "サウンドをオン"],
    "/ko": ["소리 끄기", "소리 켜기"],
    "/vi": ["Tắt âm thanh", "Bật âm thanh"],
    "/pt": ["Desativar som", "Ativar som"],
  };
  for (const [prefix, [on, off]] of Object.entries(names)) {
    await enterGame(page, "daily", `${prefix}${GAME}`);
    const mute = page.getByTestId("mute-button");
    await expect(mute).toHaveAttribute("aria-label", on);
    await mute.click();
    await expect(mute).toHaveAttribute("aria-label", off);
    await mute.click();
  }
});

test("R7 預設有聲；靜音記在本機，重新整理、再玩一次、換模式都維持", async ({ page }) => {
  await enterGame(page);
  expect((await soundState(page)).muted).toBe(false);
  await page.getByTestId("mute-button").click();
  await page.reload();
  await enterGame(page, "free");
  await expect(page.getByTestId("mute-button")).toHaveAttribute("aria-pressed", "true");
  expect((await soundState(page)).muted).toBe(true);
  await playToFinal(page);
  await page.getByTestId("again-button").click();
  await expect(page.getByTestId("mute-button")).toHaveAttribute("aria-pressed", "true");
  expect((await soundState(page)).muted).toBe(true);
});

test("R7 瀏覽器不允許儲存時照常有聲", async ({ page }) => {
  await page.addInitScript(() => {
    const deny = () => {
      throw new DOMException("denied", "SecurityError");
    };
    Storage.prototype.setItem = deny;
    Storage.prototype.getItem = deny;
  });
  await enterGame(page);
  await waitLoaded(page);
  expect((await soundState(page)).muted).toBe(false);
  await page.getByTestId("mute-button").click();
  await expect(page.getByTestId("mute-button")).toHaveAttribute("aria-pressed", "true");
  await depart(page);
  expect((await snapshot(page)).phase).toBe("running");
});

test("R5 R8 暫停、切分頁、回到介紹時聲音停止，繼續後恢復", async ({ page }) => {
  await enterGame(page);
  await waitLoaded(page);
  await depart(page);
  await page.getByTestId("scene").getByRole("button", { name: "暫停" }).click();
  await expect.poll(async () => (await soundState(page)).context).toBe("suspended");
  await page.getByTestId("resume-button").click();
  await expect.poll(async () => (await soundState(page)).context).toBe("running");
  // R5 暫停選單的按鈕有點擊音
  expect((await soundLog(page)).at(-1)).toBe("ui-click.mp3");

  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(async () => (await soundState(page)).context).toBe("suspended");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.getByTestId("resume-button").click();
  await expect.poll(async () => (await soundState(page)).context).toBe("running");

  await page.getByTestId("back-button").click();
  await expect(page.getByTestId("game-stage")).toHaveCount(0);
  await expect.poll(async () => (await soundState(page)).context).toBe("closed");
});

test("R10 音檔載入失敗時照常可玩，沒有錯誤畫面", async ({ page }) => {
  const problems = watchConsole(page);
  await page.route(`**${SFX}*`, (route) => route.abort());
  await enterGame(page);
  await expect.poll(async () => (await soundState(page)).failed, { timeout: 30_000 }).toBe(12);
  await depart(page);
  await setAutopilot(page, 10);
  await expect(page.getByTestId("judged-panel")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("game-error")).toHaveCount(0);
  // 被擋下的請求本身會在主控台留下網路錯誤，這裡只檢查沒有程式錯誤
  expect(problems.filter((line) => line.startsWith("pageerror"))).toEqual([]);
});

test("R10 瀏覽器不支援 Web Audio 時照常可玩", async ({ page }) => {
  const problems = watchConsole(page);
  await page.addInitScript(() => {
    delete (window as unknown as Record<string, unknown>).AudioContext;
    delete (window as unknown as Record<string, unknown>).webkitAudioContext;
  });
  await enterGame(page);
  expect((await soundState(page)).supported).toBe(false);
  await depart(page);
  await setAutopilot(page, 10);
  await expect(page.getByTestId("judged-panel")).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("mute-button").click();
  expect(problems).toEqual([]);
});
