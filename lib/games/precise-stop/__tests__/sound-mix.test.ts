import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dailyRoute } from "../route";
import { GameSession } from "../session";
import {
  brakeLevel,
  COUNT_UP_MS,
  judgementSound,
  runLevel,
  SOUND_FILES,
  SOUND_GAIN,
  tickTimes,
} from "../sound-mix";

describe("R1 行駛聲", () => {
  it("音高和音量隨車速升高", () => {
    const speeds = [5, 20, 35, 50, 75];
    const levels = speeds.map(runLevel);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i].rate).toBeGreaterThan(levels[i - 1].rate);
      expect(levels[i].gain).toBeGreaterThan(levels[i - 1].gain);
    }
  });

  it("停住時音量歸零", () => {
    expect(runLevel(0).gain).toBe(0);
  });

  it("35–75 km/h 之間音高在原音檔附近（0.9–1.2 倍）", () => {
    expect(runLevel(35).rate).toBeCloseTo(0.9);
    expect(runLevel(75).rate).toBeCloseTo(1.2);
    expect(runLevel(120).rate).toBeCloseTo(1.2);
  });
});

describe("R2 煞車聲", () => {
  it("音量跟著煞車力升降", () => {
    expect(brakeLevel(0, 40)).toBe(0);
    expect(brakeLevel(0.5, 40)).toBeCloseTo(0.5);
    expect(brakeLevel(1, 40)).toBe(1);
  });

  it("車停了就沒有摩擦聲，快停時漸弱", () => {
    expect(brakeLevel(1, 0)).toBe(0);
    expect(brakeLevel(1, 2)).toBeCloseTo(0.5);
  });
});

describe("R4 判定音", () => {
  it("五種判定各對應不同的音檔", () => {
    const files = (["perfect", "great", "good", "fair", "miss"] as const).map(judgementSound);
    expect(new Set(files).size).toBe(5);
    for (const file of files) expect(SOUND_FILES).toContain(file);
  });
});

describe("R5 跑分音", () => {
  it("在總分跑動期間播放，先密後疏", () => {
    const times = tickTimes();
    expect(times[0]).toBe(0);
    expect(times.at(-1)).toBeLessThan(COUNT_UP_MS / 1000);
    const gaps = times.slice(1).map((time, i) => time - times[i]);
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]).toBeGreaterThan(gaps[i - 1]);
  });
});

describe("R11 音檔與判定", () => {
  const dir = join(process.cwd(), "public/games/precise-stop/0.1.0/sfx");

  it("12 個音檔都在專案內，合計不超過 600 KB", () => {
    const files = readdirSync(dir).sort();
    expect(files).toEqual([...SOUND_FILES].sort());
    const total = files.reduce((sum, file) => sum + statSync(join(dir, file)).size, 0);
    expect(total).toBeLessThanOrEqual(600 * 1024);
  });

  it("每個音檔都有音量設定", () => {
    for (const file of SOUND_FILES) expect(SOUND_GAIN[file]).toBeGreaterThan(0);
  });

  it("音效模組不回頭影響物理與判定：同一條路線結果相同", () => {
    const play = () => {
      const session = new GameSession(dailyRoute("2026-11-15"));
      session.autopilot = true;
      for (let i = 0; i < 5; i++) {
        session.depart();
        let guard = 0;
        while (session.getSnapshot().phase === "running" && guard++ < 60 * 600) {
          const state = session.getSnapshot();
          // 模擬播放端每一格都讀取狀態計算音量
          runLevel(state.speedKmh);
          brakeLevel(state.train.brake, state.speedKmh);
          session.update(1 / 60);
        }
        session.next();
      }
      return session.getSnapshot().results;
    };
    const plain = new GameSession(dailyRoute("2026-11-15"));
    plain.autopilot = true;
    for (let i = 0; i < 5; i++) {
      plain.depart();
      let guard = 0;
      while (plain.getSnapshot().phase === "running" && guard++ < 60 * 600) plain.update(1 / 60);
      plain.next();
    }
    expect(play()).toEqual(plain.getSnapshot().results);
  });
});
