import { expect, test, type Page } from "./fixtures";
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

test("R6 R14 右上依序是音樂鈕、音效鈕、暫停鈕，44 px 以上；暫停選單的開關同步", async ({ page }) => {
  await enterGame(page);
  await waitLoaded(page);
  await depart(page);
  const music = page.getByTestId("music-button");
  const mute = page.getByTestId("mute-button");
  await expect(mute).toHaveAttribute("aria-label", "關閉音效");
  await expect(mute).toHaveAttribute("aria-pressed", "false");
  await expect(music).toHaveAttribute("aria-label", "關閉音樂");
  await expect(music).toHaveAttribute("aria-pressed", "false");
  const pause = page.getByTestId("scene").getByRole("button", { name: "暫停" });
  const [musicBox, muteBox, pauseBox, frame] = await Promise.all([
    music.boundingBox(),
    mute.boundingBox(),
    pause.boundingBox(),
    page.getByTestId("game-frame").boundingBox(),
  ]);
  for (const box of [musicBox!, muteBox!]) {
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(Math.abs(box.y - pauseBox!.y)).toBeLessThan(2);
  }
  // 右上同一列：音樂 → 音效 → 暫停
  expect(musicBox!.x + musicBox!.width).toBeLessThanOrEqual(muteBox!.x);
  expect(muteBox!.x + muteBox!.width).toBeLessThanOrEqual(pauseBox!.x);
  expect(muteBox!.y - frame!.y).toBeLessThan(frame!.height / 4);
  expect(musicBox!.x).toBeGreaterThan(frame!.x + frame!.width / 2);

  await mute.click();
  await expect(mute).toHaveAttribute("aria-pressed", "true");
  await expect(mute).toHaveAttribute("aria-label", "開啟音效");
  expect((await soundState(page)).muted).toBe(true);

  await pause.click();
  const toggle = page.getByTestId("sound-switch");
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(page.getByTestId("music-switch")).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("resume-button").click();
  await expect(mute).toHaveAttribute("aria-pressed", "false");
  expect((await soundState(page)).muted).toBe(false);
});

test("R6 R14 七種語言的音效鈕、音樂鈕都有無障礙名稱", async ({ page }) => {
  const names: Record<string, [string, string, string, string]> = {
    "": ["關閉音效", "開啟音效", "關閉音樂", "開啟音樂"],
    "/zh-cn": ["关闭音效", "开启音效", "关闭音乐", "开启音乐"],
    "/en": ["Mute sound effects", "Turn sound effects on", "Mute music", "Turn music on"],
    "/ja": ["効果音をオフ", "効果音をオン", "音楽をオフ", "音楽をオン"],
    "/ko": ["효과음 끄기", "효과음 켜기", "음악 끄기", "음악 켜기"],
    "/vi": ["Tắt hiệu ứng âm thanh", "Bật hiệu ứng âm thanh", "Tắt nhạc", "Bật nhạc"],
    "/pt": ["Desativar efeitos sonoros", "Ativar efeitos sonoros", "Desativar música", "Ativar música"],
  };
  for (const [prefix, [on, off, musicOn, musicOff]] of Object.entries(names)) {
    await enterGame(page, "daily", `${prefix}${GAME}`);
    for (const [id, a, b] of [
      ["mute-button", on, off],
      ["music-button", musicOn, musicOff],
    ] as const) {
      const button = page.getByTestId(id);
      await expect(button).toHaveAttribute("aria-label", a);
      await button.click();
      await expect(button).toHaveAttribute("aria-label", b);
      await button.click();
    }
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

const MUSIC = "/games/precise-stop/0.1.0/music/bgm.mp3";

async function waitMusic(page: Page) {
  await expect.poll(async () => (await soundState(page)).musicLoaded, { timeout: 30_000 }).toBe(true);
}

test("R13 R15 背景音樂在介紹頁不載入；遊戲畫面出現後載入並循環，判定時暫時調小", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes(MUSIC)) requests.push(request.url());
  });
  await page.goto(GAME);
  await page.waitForLoadState("networkidle");
  expect(requests).toEqual([]);
  await page.getByTestId("depart-daily").click();
  await expect(page.getByTestId("briefing")).toBeVisible({ timeout: 30_000 });
  await waitMusic(page);
  // 站點介紹時就在播
  await expect.poll(async () => (await soundState(page)).musicDuck).toBeGreaterThan(0.9);
  const state = await soundState(page);
  expect(state.musicOn).toBe(true);
  expect(state.musicGain).toBeGreaterThan(0.2);

  await depart(page);
  await setAutopilot(page, 10);
  await expect(page.getByTestId("judged-panel")).toBeVisible({ timeout: 60_000 });
  // 判定音出現時調小，之後恢復
  await expect.poll(async () => (await soundState(page)).musicDuck, { timeout: 1_000 }).toBeLessThan(0.6);
  await expect.poll(async () => (await soundState(page)).musicDuck, { timeout: 5_000 }).toBeGreaterThan(0.9);
});

test("R14 音效、音樂各自獨立：右上鈕和暫停選單同步；記在本機", async ({ page }) => {
  await enterGame(page);
  await waitMusic(page);
  await depart(page);

  // 右上音效鈕只關音效，音樂照播
  await page.getByTestId("mute-button").click();
  await expect.poll(async () => (await soundState(page)).sfxGain).toBeLessThan(0.01);
  let state = await soundState(page);
  expect(state.musicOn).toBe(true);
  expect(state.musicGain).toBeGreaterThan(0.2);
  await page.getByTestId("mute-button").click();

  // 右上音樂鈕只關音樂，音效照常
  const corner = page.getByTestId("music-button");
  await corner.click();
  await expect(corner).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await soundState(page)).musicGain).toBeLessThan(0.01);
  await expect.poll(async () => (await soundState(page)).sfxGain).toBeGreaterThan(0.99);
  state = await soundState(page);
  expect(state.musicOn).toBe(false);
  expect(state.muted).toBe(false);

  // 暫停選單的音樂開關和右上同步
  await page.getByTestId("scene").getByRole("button", { name: "暫停" }).click();
  const music = page.getByTestId("music-switch");
  await expect(music).toHaveText(/音樂/);
  await expect(music).toHaveAttribute("aria-checked", "false");
  await expect(page.getByTestId("sound-switch")).toHaveAttribute("aria-checked", "true");
  await music.click();
  await expect(music).toHaveAttribute("aria-checked", "true");
  await music.click();
  await page.getByTestId("resume-button").click();
  await expect(corner).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await enterGame(page, "free");
  expect((await soundState(page)).musicOn).toBe(false);
  await expect(page.getByTestId("music-button")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("mute-button")).toHaveAttribute("aria-pressed", "false");
});

test("R14 瀏覽器不允許儲存時音樂照常播放", async ({ page }) => {
  await page.addInitScript(() => {
    const deny = () => {
      throw new DOMException("denied", "SecurityError");
    };
    Storage.prototype.setItem = deny;
    Storage.prototype.getItem = deny;
  });
  await enterGame(page);
  await waitMusic(page);
  expect((await soundState(page)).musicOn).toBe(true);
});

test("R15 背景音樂載入失敗時照常可玩，音效不受影響", async ({ page }) => {
  await page.route(`**${MUSIC}`, (route) => route.abort());
  await enterGame(page);
  await expect.poll(async () => (await soundState(page)).musicFailed, { timeout: 30_000 }).toBe(true);
  expect((await soundState(page)).loaded).toBe(12);
  await depart(page);
  await setAutopilot(page, 10);
  await expect(page.getByTestId("judged-panel")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("game-error")).toHaveCount(0);
});

test("R16 暫停時背景音樂停住，繼續後從原處接著播", async ({ page }) => {
  await enterGame(page);
  await waitMusic(page);
  await depart(page);
  await page.getByTestId("scene").getByRole("button", { name: "暫停" }).click();
  await expect.poll(async () => (await soundState(page)).context).toBe("suspended");
  const paused = (await soundState(page)).musicTime;
  await page.waitForTimeout(800);
  expect((await soundState(page)).musicTime).toBeCloseTo(paused, 1);
  await page.getByTestId("resume-button").click();
  await expect.poll(async () => (await soundState(page)).musicTime).toBeGreaterThan(paused + 0.2);
  expect((await soundState(page)).musicTime).toBeLessThan(paused + 3);
});
