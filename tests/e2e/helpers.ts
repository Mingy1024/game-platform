import { expect, type Page } from "@playwright/test";

export const GAME = "/games/precise-stop";

type Hook = {
  session: {
    autopilot: boolean;
    timeScale: number;
    getSnapshot(): {
      phase: string;
      paused: boolean;
      braking: boolean;
      zoomed: boolean;
      index: number;
      total: number;
      train: { distance: number; brake: number };
    };
  };
  fx: Record<string, number>;
};

export type SoundState = {
  supported: boolean;
  context: string;
  muted: boolean;
  active: boolean;
  loaded: number;
  failed: number;
  runGain: number;
  runRate: number;
  brakeGain: number;
};

type SoundHook = { state: SoundState; log: { name: string; at: number }[] };

declare global {
  interface Window {
    __preciseStop: Hook;
    __preciseStopSound?: SoundHook;
  }
}

export const soundState = (page: Page) => page.evaluate(() => window.__preciseStopSound!.state);

/** 播放過的音效名稱（依時間順序） */
export const soundLog = (page: Page) =>
  page.evaluate(() => window.__preciseStopSound!.log.map((entry) => entry.name));

/** 收集主控台的錯誤和警告（驗收 Q3） */
export function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (!["error", "warning"].includes(message.type())) return;
    // 無頭瀏覽器用軟體繪圖時 Chromium 自己印的效能提示，和網站無關
    if (message.text().includes("GL Driver Message")) return;
    problems.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${String(error)}`));
  return problems;
}

/** 從介紹頁按出發，等站點介紹出現 */
export async function enterGame(page: Page, mode: "daily" | "free" = "daily", path = GAME) {
  await page.goto(path);
  await page.getByTestId(`depart-${mode}`).click();
  await expect(page.getByTestId("briefing")).toBeVisible({ timeout: 30_000 });
}

export async function depart(page: Page) {
  await page.getByTestId("depart-button").click();
  await expect(page.getByTestId("game-stage")).toHaveAttribute("data-phase", "running");
}

export const snapshot = (page: Page) => page.evaluate(() => window.__preciseStop.session.getSnapshot());

export async function setAutopilot(page: Page, timeScale = 1) {
  await page.evaluate((scale) => {
    window.__preciseStop.session.autopilot = true;
    window.__preciseStop.session.timeScale = scale;
  }, timeScale);
}

/** 用自動駕駛跑完 5 站，停在結算畫面 */
export async function playToFinal(page: Page) {
  for (let station = 0; station < 5; station++) {
    await depart(page);
    await setAutopilot(page, 10);
    await expect(page.getByTestId("judged-panel")).toBeVisible({ timeout: 60_000 });
    await page.getByTestId("next-button").click();
  }
  await expect(page.getByTestId("final-panel")).toBeVisible();
}
