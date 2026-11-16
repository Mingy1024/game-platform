import { describe, expect, it } from "vitest";
import { FX } from "../config";
import { closePpm, computeView, VIEW } from "../view";

describe("F11 遠景比例", () => {
  it("1 m＝20 px，一節 20 m 的車廂是 400 px", () => {
    expect(VIEW.farPpm).toBe(20);
    expect(VIEW.trainFarWidth).toBe(20 * VIEW.farPpm);
    expect(computeView(80, 0)).toMatchObject({ ppm: 20, trainScale: 1, backgroundScale: 1 });
  });

  it("遠處時列車固定在畫面上，標線在畫面外", () => {
    const view = computeView(80, 0);
    expect(view.noseX).toBe(VIEW.noseFarX);
    expect(view.markX).toBeGreaterThan(VIEW.width);
  });

  it("標線進到畫面右側後固定，換列車往前", () => {
    const a = computeView(6, 0);
    const b = computeView(5.5, 0);
    expect(a.markX).toBe(VIEW.markFarX);
    expect(b.markX).toBe(VIEW.markFarX);
    expect(b.noseX - a.noseX).toBeCloseTo(0.5 * 20, 6);
    expect(a.platformShift).toBe(0);
  });

  it("標線固定前後的畫面連續", () => {
    const lock = (VIEW.markFarX - VIEW.noseFarX) / VIEW.farPpm;
    const before = computeView(lock + 1e-6, 0);
    const after = computeView(lock - 1e-6, 0);
    expect(before.markX).toBeCloseTo(after.markX, 3);
    expect(before.noseX).toBeCloseTo(after.noseX, 3);
  });
});

describe("F4／F6 近站放大", () => {
  it("車頭位置永遠等於標線位置減去距離 × 比例尺", () => {
    for (const distance of [120, 6.5, 5, 3, 1, 0.42, 0.02, 0, -0.5, -3.4, -15]) {
      for (const zoom of [0, 0.3, 1]) {
        const view = computeView(distance, zoom);
        expect(view.noseX).toBeCloseTo(view.markX - distance * view.ppm, 6);
      }
    }
  });

  it("2.5 m 內用最大比例尺 84 px/m，標線在 x=300", () => {
    const view = computeView(0.42, 1);
    expect(view.ppm).toBe(84);
    expect(view.markX).toBe(VIEW.markCloseX);
    expect(view.noseX).toBeCloseTo(300 - 0.42 * 84, 6);
    expect(view.trainScale).toBeCloseTo(VIEW.trainCloseScale, 6);
  });

  it("剛進入放大時列車仍在畫面內，比例尺隨距離連續變化", () => {
    const at5 = computeView(FX.zoomAt, 1);
    expect(at5.noseX).toBeCloseTo(VIEW.noseCloseX, 6);
    expect(at5.ppm).toBeGreaterThan(VIEW.farPpm);
    expect(at5.ppm).toBeLessThan(VIEW.closePpm);
    let previous = closePpm(5);
    for (let d = 4.9; d >= 0; d -= 0.1) {
      const ppm = closePpm(d);
      expect(ppm).toBeGreaterThanOrEqual(previous);
      expect(ppm - previous).toBeLessThan(6);
      previous = ppm;
    }
  });

  it("過站時縮小比例尺，把車頭和標線都留在畫面內", () => {
    const view = computeView(-3.4, 1);
    expect(view.noseX).toBeLessThanOrEqual(VIEW.noseMaxX + 1e-6);
    expect(view.markX).toBeCloseTo(VIEW.markCloseX, 6);
    expect(view.ppm).toBeLessThan(VIEW.closePpm);
    const far = computeView(-15, 1);
    expect(far.noseX).toBeCloseTo(VIEW.noseMaxX, 6);
    expect(far.markX).toBeLessThan(VIEW.markCloseX);
  });

  it("完美區 ±5 cm 在最大比例尺下至少 8 px 寬，看得出來", () => {
    expect(0.1 * VIEW.closePpm).toBeGreaterThanOrEqual(8);
  });
});

describe("G2 視差", () => {
  it("遠景時月台層比軌道層捲得慢，標線固定後歸零", () => {
    const moving = computeView(60, 0);
    expect(moving.platformShift).toBeGreaterThan(0);
    expect(VIEW.platformParallax).toBeLessThan(1);
    expect(VIEW.postParallax).toBeGreaterThan(1);
    expect(computeView(3, 1).platformShift).toBe(0);
  });
});
