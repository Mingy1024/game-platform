import { describe, expect, it } from "vitest";
import { runAutopilot } from "../autopilot";
import { PHYSICS, kmhToMs } from "../config";
import {
  createTrainState,
  fullBrakeDistance,
  predictHoldStop,
  startDistance,
  stepTrain,
  type Conditions,
} from "../physics";
import { generateRoute } from "../route";

const flat: Conditions = { speedKmh: 54, grade: 0, rain: false };
const steps = (seconds: number) => Math.round(seconds / PHYSICS.step);

function run(conditions: Conditions, held: (time: number) => boolean, seconds: number) {
  const state = createTrainState(conditions);
  for (let i = 0; i < steps(seconds); i++) stepTrain(state, held(i * PHYSICS.step), conditions);
  return state;
}

describe("B1 煞車力", () => {
  it("按住 0.5 秒從 0 升到 100%", () => {
    expect(run(flat, () => true, 0.25).brake).toBeCloseTo(0.5, 5);
    expect(run(flat, () => true, 0.5).brake).toBeCloseTo(1, 5);
    expect(run(flat, () => true, 2).brake).toBe(1);
  });

  it("放開 0.25 秒歸零", () => {
    const state = run(flat, (time) => time < 1, 1.125);
    expect(state.brake).toBeCloseTo(0.5, 5);
    expect(run(flat, (time) => time < 1, 1.25).brake).toBeCloseTo(0, 5);
  });

  it("全力煞車的減速度是 1.6 m/s²（加上滑行阻力）", () => {
    const state = createTrainState(flat);
    state.brake = 1;
    const before = state.speed;
    for (let i = 0; i < steps(1); i++) stepTrain(state, true, flat);
    expect(before - state.speed).toBeCloseTo(PHYSICS.fullBrake + PHYSICS.drag, 6);
  });
});

describe("B2 滑行與坡度", () => {
  it("平地滑行每秒減速 0.04 m/s", () => {
    const state = run(flat, () => false, 1);
    expect(kmhToMs(flat.speedKmh) - state.speed).toBeCloseTo(0.04, 6);
  });

  it("上坡減速、下坡加速，大小是 g × 坡度", () => {
    const up = run({ ...flat, grade: 0.02 }, () => false, 1);
    const down = run({ ...flat, grade: -0.02 }, () => false, 1);
    const v0 = kmhToMs(flat.speedKmh);
    expect(v0 - up.speed).toBeCloseTo(0.04 + 9.81 * 0.02, 6);
    expect(down.speed - v0).toBeCloseTo(9.81 * 0.02 - 0.04, 6);
  });
});

describe("B3 雨天", () => {
  it("煞車力乘以 0.75", () => {
    const rain = { ...flat, rain: true };
    const state = createTrainState(rain);
    state.brake = 1;
    const before = state.speed;
    for (let i = 0; i < steps(1); i++) stepTrain(state, true, rain);
    expect(before - state.speed).toBeCloseTo(1.6 * 0.75 + 0.04, 6);
  });
});

describe("B4 起始距離", () => {
  it("是全力煞車停車距離的 1.6 倍", () => {
    for (const conditions of [
      flat,
      { speedKmh: 70, grade: -0.03, rain: true },
      { speedKmh: 40, grade: 0.025, rain: false },
    ]) {
      expect(startDistance(conditions)).toBeCloseTo(fullBrakeDistance(conditions) * 1.6, 9);
      expect(createTrainState(conditions).distance).toBe(startDistance(conditions));
    }
    // 54 km/h 平地：15² / (2 × 1.64) × 1.6
    expect(startDistance(flat)).toBeCloseTo((225 / 3.28) * 1.6, 6);
  });
});

describe("B5 固定步進", () => {
  it("同樣的輸入序列一定得到同樣的結果", () => {
    const pattern = (time: number) => time > 3 && Math.floor(time * 4) % 3 !== 0;
    const a = run({ speedKmh: 66, grade: -0.02, rain: true }, pattern, 20);
    const b = run({ speedKmh: 66, grade: -0.02, rain: true }, pattern, 20);
    expect(a).toEqual(b);
  });

  it("步進固定為 1/120 秒", () => {
    expect(PHYSICS.step).toBe(1 / 120);
  });

  it("解析預測和逐步模擬的停車位置一致", () => {
    const conditions = { speedKmh: 60, grade: -0.02, rain: true };
    const state = createTrainState(conditions);
    for (let i = 0; i < steps(2); i++) stepTrain(state, false, conditions);
    const predicted = predictHoldStop(state.distance, state.speed, state.brake, conditions);
    while (!state.settled) stepTrain(state, true, conditions);
    expect(state.distance).toBeCloseTo(predicted, 3);
  });
});

describe("B6 停穩與緊急停車", () => {
  it("速度為 0 維持 0.3 秒才判定", () => {
    const conditions = { speedKmh: 36, grade: 0, rain: false };
    const state = createTrainState(conditions);
    while (state.speed > 0) stepTrain(state, true, conditions);
    expect(state.settled).toBe(false);
    for (let i = 0; i < steps(0.3) - 2; i++) stepTrain(state, true, conditions);
    expect(state.settled).toBe(false);
    for (let i = 0; i < 4; i++) stepTrain(state, true, conditions);
    expect(state.settled).toBe(true);
  });

  it("停穩之後時間不再增加", () => {
    const conditions = { speedKmh: 36, grade: 0, rain: false };
    const state = createTrainState(conditions);
    while (state.speed > 0) stepTrain(state, true, conditions);
    const stoppedAt = state.elapsed;
    for (let i = 0; i < 20; i++) stepTrain(state, true, conditions);
    expect(state.elapsed).toBe(stoppedAt);
  });

  it("下坡放開煞車會再滑動，停穩計時重來", () => {
    const conditions = { speedKmh: 36, grade: -0.03, rain: false };
    const state = createTrainState(conditions);
    while (state.speed > 0) stepTrain(state, true, conditions);
    for (let i = 0; i < steps(0.5); i++) stepTrain(state, false, conditions);
    expect(state.speed).toBeGreaterThan(0);
    expect(state.settled).toBe(false);
    expect(state.stoppedFor).toBe(0);
  });

  it("上坡停下後不會倒退", () => {
    const conditions = { speedKmh: 36, grade: 0.03, rain: false };
    const state = run(conditions, () => false, 60);
    expect(state.speed).toBe(0);
    expect(state.settled).toBe(true);
  });

  it("超過標線 15 m 自動緊急停車", () => {
    const conditions = { speedKmh: 70, grade: -0.03, rain: true };
    const state = createTrainState(conditions);
    let guard = 0;
    while (!state.settled && guard++ < 120 * 600) stepTrain(state, false, conditions);
    expect(state.emergency).toBe(true);
    expect(state.settled).toBe(true);
    expect(state.distance).toBeLessThan(-PHYSICS.overrunLimit);
  });
});

describe("B7 每一站都停得進完美區", () => {
  it("1,000 組隨機路線，只用按住／放開都能停在 5 cm 內", () => {
    let worst = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      for (const stop of generateRoute(seed * 7919, "free").stops) {
        const result = runAutopilot(stop);
        worst = Math.max(worst, Math.abs(result.error));
      }
    }
    expect(worst).toBeLessThanOrEqual(0.05);
  }, 60_000);
});
