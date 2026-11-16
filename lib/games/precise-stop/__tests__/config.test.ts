import { describe, expect, it } from "vitest";
import { FX, PHYSICS, SCORING } from "../config";

describe("G9 特效上限", () => {
  it("火花加彩帶同時最多 60 個粒子", () => {
    expect(FX.maxSparks + FX.maxConfetti).toBeLessThanOrEqual(60);
  });

  it("過站震動不超過 4 px", () => {
    expect(FX.shakePx).toBeLessThanOrEqual(4);
  });

  it("速度線門檻 40 km/h、5 m 進入放大", () => {
    expect(FX.speedLinesAboveKmh).toBe(40);
    expect(FX.zoomAt).toBe(5);
  });
});

describe("規格數值", () => {
  it("物理參數（B1–B6）", () => {
    expect(PHYSICS).toMatchObject({
      fullBrake: 1.6,
      rampUp: 0.5,
      rampDown: 0.25,
      drag: 0.04,
      rainFactor: 0.75,
      startFactor: 1.6,
      settle: 0.3,
      overrunLimit: 15,
    });
  });

  it("判定門檻（C1）", () => {
    expect(SCORING).toMatchObject({ perfect: 0.05, great: 0.3, good: 1, fair: 2, comboMax: 1.5 });
  });
});
