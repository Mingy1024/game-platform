import { describe, expect, it } from "vitest";
import { CAMERA, DECAL, DRAW, FLOORS, SOUP, STEP, TEMP, TOWER, WALK } from "../config";
import { drawCamera, inSafeArea, project, routeRegion, walkCamera } from "../camera";
import { allLayouts, flipLayout, groundAt, layoutsOf, LAYOUTS, walkable, type Layout, type Vec2 } from "../layouts";
import { buildPath, resample, sampleAt } from "../path";
import { compareRuns, displayTemp, gradeOf, scoreOf, tempBand, temperatureAt, tempFactor } from "../scoring";
import { MonkSession } from "../session";
import { createFloorSim, slippery, stepFloor, tilt, type FloorSim } from "../sim";
import { clearanceGrid, CLEARANCE, findRoute, idealLine } from "../solver";
import { fixedTower, randomTower, seedLabel } from "../tower";

const line = (layout: Layout) => idealLine(layout)!;
const simOf = (layout: Layout, points: Vec2[] = line(layout), soup = 1000) => createFloorSim(layout, buildPath([layout.start, ...points]), soup);
const straight = (from: Vec2, to: Vec2, n = 40): Vec2[] =>
  Array.from({ length: n + 1 }, (_, i) => ({ x: from.x + ((to.x - from.x) * i) / n, z: from.z + ((to.z - from.z) * i) / n }));
/** 第 1 層代表版型去掉水窪：測直線、加減速用 */
const dry: Layout = { ...LAYOUTS[0]![0]!, puddles: [] };

/** 讓 session 跳過 intro，回傳在 draw 階段的 session */
function atDraw(session: MonkSession) {
  while (session.phase === "intro") session.update(100);
  return session;
}

/** 自動駕駛跑完一局 */
function autoplay(session: MonkSession) {
  session.autopilot = true;
  for (let i = 0; i < 100_000 && session.phase !== "over"; i++) session.update(100);
  return session.result!;
}

describe("A 範圍", () => {
  it("A4 兩種模式：固定關卡、隨機模式", () => {
    expect(new MonkSession("fixed").tower.mode).toBe("fixed");
    expect(new MonkSession("random", 42).tower.mode).toBe("random");
  });
  it("A5 一局 5 層，一碗湯到底、過層不補", () => {
    expect(FLOORS).toBe(5);
    const session = new MonkSession("fixed");
    expect(session.tower.floors).toHaveLength(5);
    session.autopilot = true;
    let lastSoup = 1000;
    let floors = 0;
    for (let i = 0; i < 100_000 && session.phase !== "over"; i++) {
      for (const event of session.update(100)) if (event.type === "floor") floors++;
      expect(session.soup).toBeLessThanOrEqual(lastSoup + 1e-9);
      lastSoup = session.soup;
    }
    expect(floors).toBe(5);
    expect(session.result?.outcome).toBe("summit");
  });
});

describe("B 核心規則", () => {
  it("B1 起點要在和尚腳下 0.9 單位內", () => {
    const session = atDraw(new MonkSession("fixed"));
    const s = session.layout.start;
    expect(DRAW.startRadius).toBe(0.9);
    expect(session.canStartAt({ x: s.x + 0.89, z: s.z })).toBe(true);
    expect(session.canStartAt({ x: s.x + 0.95, z: s.z })).toBe(false);
    expect(session.setLine([{ x: s.x + 1.5, z: s.z }, session.layout.goal])).toBe("start");
  });
  it("B2 一筆畫：終點不在樓梯口金色圓圈（半徑 0.7）內就清掉線", () => {
    const session = atDraw(new MonkSession("fixed"));
    const g = session.layout.goal;
    const points = line(session.layout);
    expect(session.setLine([...points.slice(0, -1), { x: g.x, z: g.z + 0.75 }])).toBe("goal");
    expect(session.path).toBeNull();
    expect(session.phase).toBe("draw");
    expect(session.setLine([...points.slice(0, -1), { x: g.x, z: g.z + 0.65 }])).toBe("ok");
    expect(session.phase).toBe("ready");
  });
  it("B3 放開後每隔 0.3 單位取一點，平滑曲線通過起點與終點", () => {
    const raw = straight({ x: 0, z: 0 }, { x: 3, z: 0 }, 300);
    const points = resample(raw);
    expect(points).toHaveLength(11);
    for (let i = 1; i < points.length; i++) expect(Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.z - points[i - 1]!.z)).toBeCloseTo(0.3, 5);
    const path = buildPath(raw);
    expect(path.length).toBeCloseTo(3, 2);
    const end = sampleAt(path, path.length);
    expect(end.x).toBeCloseTo(3, 5);
  });
  it("B4 走之前可以重畫；開始走之後不能重畫", () => {
    const session = atDraw(new MonkSession("fixed"));
    expect(session.setLine(line(session.layout))).toBe("ok");
    expect(session.canRedraw).toBe(true);
    expect(session.redraw()).toBe(true);
    expect(session.phase).toBe("draw");
    session.setLine(line(session.layout));
    session.setHolding(true);
    expect(session.phase).toBe("walk");
    expect(session.redraw()).toBe(false);
    expect(session.canRedraw).toBe(false);
  });
  it("B5 按住 0.25 秒加速到 1.6 單位／秒，放開 0.2 秒停下；滑區加速度減半", () => {
    expect(WALK.speed).toBe(1.6);
    const sim = simOf(dry, straight(dry.start, { x: 4.5, z: 4 }));
    for (let i = 0; i < 15; i++) stepFloor(sim, true);
    expect(sim.v).toBeCloseTo(1.6, 5);
    for (let i = 0; i < 12; i++) stepFloor(sim, false);
    expect(sim.v).toBeCloseTo(0, 9);
    const wet: Layout = { ...dry, puddles: [{ x: 2.6, z: 4, rx: 3, rz: 1, rot: 0 }] };
    const slipSim = simOf(wet, straight(wet.start, { x: 4.5, z: 4 }));
    expect(slippery(slipSim, wet.start)).toBe(true);
    for (let i = 0; i < 15; i++) stepFloor(slipSim, true);
    expect(slipSim.v).toBeCloseTo(0.8, 5);
  });
  it("B6 k = 40、c = 6、60 Hz；停下後約 1.2 秒回平", () => {
    expect([SOUP.k, SOUP.c, STEP]).toEqual([40, 6, 1 / 60]);
    const sim = simOf(dry, straight(dry.start, { x: 4.5, z: 4 }));
    for (let i = 0; i < 60; i++) stepFloor(sim, true);
    for (let i = 0; i < 12; i++) stepFloor(sim, false);
    expect(tilt(sim)).toBeGreaterThan(0.05);
    for (let i = 0; i < 72; i++) stepFloor(sim, false);
    expect(tilt(sim)).toBeLessThan(SOUP.settled);
  });
  it("B7 直線等速時 a = 0：湯面保持平；轉彎會讓湯面左右傾斜", () => {
    const sim = simOf(dry, straight(dry.start, { x: 4.5, z: 4 }));
    for (let i = 0; i < 90; i++) stepFloor(sim, true);
    for (let i = 0; i < 40; i++) stepFloor(sim, true);
    expect(tilt(sim)).toBeLessThan(0.01);
    const turn = simOf(dry);
    let maxLat = 0;
    while (!turn.done) {
      stepFloor(turn, true);
      maxLat = Math.max(maxLat, Math.abs(turn.lat));
    }
    expect(maxLat).toBeGreaterThan(0.2);
  });
  it("B8 |θ| > 0.35 時每秒灑掉 (|θ| − 0.35) × 25%；湯量不低於 0", () => {
    const sim = simOf(dry, straight(dry.start, { x: 4.5, z: 4 }), 1000);
    sim.lat = 0.55;
    sim.latV = 0;
    stepFloor(sim, false);
    // 一步之後 θ 幾乎沒變：灑掉約 (0.55 − 0.35) × 25 %／秒 × 1/60 秒
    expect(1000 - sim.soup).toBeCloseTo(((0.55 - 0.35) * 25 * 10) / 60, 1);
    const empty = simOf(dry, straight(dry.start, { x: 4.5, z: 4 }), 0.01);
    empty.lat = 1;
    stepFloor(empty, false);
    expect(empty.soup).toBe(0);
    expect(empty.done).toBe("empty");
  });
  it("B9 滑區上 a × 2、c × 0.5：同一條線灑得比較多", () => {
    expect([SOUP.slipA, SOUP.slipC]).toEqual([2, 0.5]);
    const route = line(dry);
    const a = simOf(dry, route);
    const wet: Layout = { ...dry, puddles: [{ x: 4, z: 4, rx: 1.5, rz: 1.5, rot: 0 }] };
    const b = simOf(wet, route);
    while (!a.done) stepFloor(a, true);
    while (!b.done) stepFloor(b, true);
    expect(b.soup).toBeLessThan(a.soup);
  });
  it("B10 階梯每經過一級，a 加 6（斜坡不算）", () => {
    expect(SOUP.stepKick).toBe(6);
    const stairs = layoutsOf(2)[2]!; // 2c：兩端都是階梯
    const sim = simOf(stairs);
    let kicks = 0;
    let lastLevel = sim.level;
    while (!sim.done) {
      stepFloor(sim, true);
      if (sim.kick === SOUP.stepPulse - STEP || (sim.level !== lastLevel && sim.level !== -1 && lastLevel !== -1)) kicks++;
      lastLevel = sim.level;
    }
    expect(kicks).toBe(6);
    // 2a：一端是斜坡、一端是階梯，只有階梯那 3 級會震
    const ramp = layoutsOf(2)[0]!;
    const levels: number[] = [];
    for (let z = -2.6; z <= 2.4; z += 0.05) levels.push(groundAt(ramp, { x: 4, z }).level);
    const changes = levels.filter((level, i) => i > 0 && level !== levels[i - 1] && level !== -1 && levels[i - 1] !== -1).length;
    expect(changes).toBe(3);
  });
  it("B11 灑湯時留下湯漬：之後經過算滑區；換層後不帶過去", () => {
    const sim = simOf(dry);
    sim.lat = 0.6;
    stepFloor(sim, false);
    expect(sim.decals).toHaveLength(1);
    expect(sim.decals[0]!.r).toBe(DECAL.radius);
    expect(slippery(sim, { x: sim.decals[0]!.x + 0.1, z: sim.decals[0]!.z })).toBe(true);
    const next = createFloorSim(dry, sim.path, sim.soup);
    expect(next.decals).toHaveLength(0);
    expect(DECAL.steamSeconds).toBe(3);
  });
  it("B13 中心點離開可走的地面就摔下去；欄杆不擋人", () => {
    const broken = layoutsOf(3)[0]!;
    // 從起點直直走出前廊外緣
    const sim = simOf(broken, straight(broken.start, { x: 1.2, z: 6.5 }));
    while (!sim.done) stepFloor(sim, true);
    expect(sim.done).toBe("fall");
    // 走進斷掉的迴廊（不是橫樑）
    expect(walkable(broken, { x: 3.5, z: 0 })).toBe(false);
    expect(walkable(broken, { x: 4.5, z: 0 })).toBe(true);
    expect(walkable(broken, { x: 5.05, z: 4 })).toBe(false);
  });
  it("B14 摔下去或湯量到 0%，這局立刻結束", () => {
    const session = atDraw(new MonkSession("fixed"));
    session.setLine(straight(session.layout.start, { x: session.layout.start.x, z: 6.5 }).concat([session.layout.goal]));
    // 終點在樓梯口，但路線會先走出外緣
    session.setHolding(true);
    for (let i = 0; i < 2000 && session.phase === "walk"; i++) session.update(50);
    expect(session.phase).toBe("falling");
    session.finish();
    expect(session.result?.outcome).toBe("fall");
    expect(session.result?.score).toBeNull();
  });
  it("B15 走到樓梯口自動上樓；第 5 層送達塔頂並結算", () => {
    const session = atDraw(new MonkSession("fixed"));
    const events: string[] = [];
    session.autopilot = true;
    for (let i = 0; i < 100_000 && session.phase !== "over"; i++) for (const e of session.update(100)) if (e.type === "floor" || e.type === "summit" || e.type === "over") events.push(e.type === "floor" ? `floor${e.floor}` : e.type);
    expect(events).toEqual(["floor2", "floor3", "floor4", "floor5", "summit", "over"]);
  });
  it("B16 同一座塔、同一條線、同一串按放時間，結果完全相同", () => {
    const play = () => {
      const session = new MonkSession("random", 123456);
      session.autopilot = true;
      // 用不規則的畫面間隔：步數只看模擬時間，不受畫面更新頻率影響
      const frames = [16, 17, 33, 8, 50, 100];
      for (let i = 0; i < 100_000 && session.phase !== "over"; i++) session.update(frames[i % frames.length]!);
      return session.result;
    };
    expect(play()).toEqual(play());
  });
  it("B16 一格畫面裡按下又放開：短按不會被吃掉，至少走了一步（Codex 審查第 2 輪）", () => {
    const session = atDraw(new MonkSession("fixed"));
    session.setLine(line(session.layout));
    session.setHolding(true);
    session.setHolding(false);
    expect(session.phase).toBe("walk");
    session.update(1000 / 30);
    expect(session.sim!.s).toBeGreaterThan(0);
    // 不同的畫面更新頻率、同一串按放（每次按放都在畫面之間）：結果相同
    const run = (frame: number) => {
      const s = atDraw(new MonkSession("fixed"));
      s.setLine(line(s.layout));
      let t = 0;
      const until = (ms: number) => {
        while (t + frame <= ms + 1e-9) {
          s.update(frame);
          t += frame;
        }
      };
      s.setHolding(true);
      until(1000);
      s.setHolding(false);
      until(1500);
      s.setHolding(true);
      until(4000);
      return { s: s.sim!.s.toFixed(6), soup: s.soup.toFixed(6) };
    };
    expect(run(1000 / 30)).toEqual(run(1000 / 60));
  });

  it("B17 暫停時模擬停止：溫度、湯面、位置都不變", () => {
    const session = atDraw(new MonkSession("fixed"));
    session.setLine(line(session.layout));
    session.setHolding(true);
    session.update(300);
    session.pause();
    const before = { t: session.timeMs, s: session.sim!.s, lat: session.sim!.lat, soup: session.soup };
    for (let i = 0; i < 50; i++) session.update(100);
    expect({ t: session.timeMs, s: session.sim!.s, lat: session.sim!.lat, soup: session.soup }).toEqual(before);
    session.resume();
    expect(session.phase).toBe("walk");
  });
});

describe("C 計分", () => {
  it("C1 開局 80℃，每秒降 0.3℃，100 秒到 50℃；畫線時也在降、暫停不降", () => {
    expect(temperatureAt(0)).toBe(80);
    expect(temperatureAt(10_000)).toBeCloseTo(77, 9);
    expect(temperatureAt(100_000)).toBeCloseTo(50, 9);
    const session = atDraw(new MonkSession("fixed"));
    const t0 = session.timeMs;
    session.update(100);
    session.update(100);
    expect(session.timeMs - t0).toBeGreaterThanOrEqual(183);
    expect(session.timeMs - t0).toBeLessThanOrEqual(217);
    const t1 = session.timeMs;
    session.pause();
    session.update(100);
    expect(session.timeMs).toBe(t1);
  });
  it("C2 顯示的溫度無條件捨去：49.97℃ 顯示 49.9，不會出現「50℃ 涼掉了」（Codex 審查第 2 輪）", () => {
    expect(displayTemp(100_100)).toBe(49.9);
    expect(tempBand(temperatureAt(100_100))).toBe("cold");
    expect(Math.floor(displayTemp(100_100))).toBe(49);
    expect(displayTemp(40_000)).toBe(68);
    expect(displayTemp(0)).toBe(80);
  });

  it("C2 溫度分段與邊界", () => {
    expect(tempBand(75)).toBe("hot");
    expect(tempBand(70)).toBe("hot");
    expect(tempBand(69.9)).toBe("veryWarm");
    expect(tempBand(60)).toBe("veryWarm");
    expect(tempBand(59.9)).toBe("warm");
    expect(tempBand(50)).toBe("warm");
    expect(tempBand(49.9)).toBe("cold");
  });
  it("C3 溫度係數", () => {
    expect(tempFactor(80)).toBeCloseTo(1, 9);
    expect(tempFactor(65)).toBeCloseTo(0.85, 9);
    expect(tempFactor(50)).toBeCloseTo(0.7, 9);
    expect(tempFactor(49.99)).toBe(0.5);
  });
  it("C4 得分 = round(湯量% × 10 × f)，0～1000", () => {
    expect(scoreOf(1000, 0)).toBe(1000);
    expect(scoreOf(0, 0)).toBe(0);
    expect(scoreOf(1200, 0)).toBe(1000);
    expect(scoreOf(500, 200_000)).toBe(250);
  });
  it("C5 評級：S ≥ 820、A ≥ 680、B ≥ 480、其餘 C；邊界屬於較高的一級", () => {
    expect([gradeOf(820), gradeOf(819), gradeOf(680), gradeOf(679), gradeOf(480), gradeOf(479)]).toEqual(["S", "A", "A", "B", "B", "C"]);
  });
  it("C6 設計稿範例", () => {
    expect(temperatureAt(40_000)).toBeCloseTo(68, 9);
    expect(scoreOf(960, 40_000)).toBe(845);
    expect(gradeOf(845)).toBe("S");
    expect(temperatureAt(50_000)).toBeCloseTo(65, 9);
    expect(scoreOf(900, 50_000)).toBe(765);
    expect(gradeOf(765)).toBe("A");
    expect(temperatureAt(80_000)).toBeCloseTo(56, 9);
    expect(scoreOf(700, 80_000)).toBe(532);
    expect(gradeOf(532)).toBe("B");
  });
  it("C7 同分時總時間短的排前面", () => {
    const runs = [
      { score: 800, timeMs: 50_000 },
      { score: 800, timeMs: 45_000 },
      { score: 820, timeMs: 60_000 },
    ].sort(compareRuns);
    expect(runs.map((r) => r.timeMs)).toEqual([60_000, 45_000, 50_000]);
  });
  it("C8 摔下去或湯灑光沒有分數，只記到第幾層", () => {
    const session = atDraw(new MonkSession("fixed"));
    session.setLine(straight(session.layout.start, { x: session.layout.start.x, z: 6.5 }).concat([session.layout.goal]));
    session.setHolding(true);
    for (let i = 0; i < 2000 && session.phase === "walk"; i++) session.update(50);
    session.finish();
    expect(session.result).toMatchObject({ outcome: "fall", floor: 1, score: null, grade: null });
  });
  it("C9 總時間從第 1 層可以畫線算起，含畫線與停下，不含暫停與過層動畫", () => {
    const session = new MonkSession("fixed");
    session.update(100);
    expect(session.phase).toBe("intro");
    expect(session.timeMs).toBe(0);
    const result = autoplay(session);
    // 自動駕駛在每層先等 0.8 秒才畫線：時間一定比純走路長，而且不含 5 次 1.6 秒的過層
    expect(result.timeMs).toBeGreaterThan(5 * 800);
    expect(result.outcome).toBe("summit");
    expect(result.temp).toBe(Math.floor((80 - (0.3 * result.timeMs) / 1000) * 10 + 1e-9) / 10);
    expect(result.score).toBe(scoreOf(result.soup, result.timeMs));
  });
});

describe("D 關卡產生", () => {
  it("D1 隨機模式：5 層、每層 4～6 種版型；種子決定版型與翻轉", () => {
    for (let floor = 1; floor <= 5; floor++) {
      expect(layoutsOf(floor).length).toBeGreaterThanOrEqual(4);
      expect(layoutsOf(floor).length).toBeLessThanOrEqual(6);
    }
    const seen = new Set<string>();
    let flips = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const tower = randomTower(seed);
      expect(tower.floors).toHaveLength(5);
      tower.floors.forEach((f, i) => {
        expect(f.floor).toBe(i + 1);
        seen.add(f.id);
        if (f.flipped) flips++;
      });
    }
    expect(seen.size).toBe(20);
    expect(flips).toBeGreaterThan(300);
    expect(flips).toBeLessThan(700);
  });
  it("D2 固定關卡：五層代表版型、不翻轉，每一局都一樣", () => {
    const tower = fixedTower();
    expect(tower.floors.map((f) => f.id)).toEqual(["1a", "2a", "3a", "4a", "5a"]);
    expect(tower.floors.every((f) => !f.flipped)).toBe(true);
    expect(new MonkSession("fixed").tower).toEqual(new MonkSession("fixed").tower);
  });
  it("D3 隨機模式每局新種子；結算帶塔號，同一個塔號重玩同一座塔", () => {
    let n = 0;
    const session = new MonkSession("random", null, false, () => [111, 222, 333][n++ % 3]!);
    expect(session.tower.seed).toBe(111);
    session.restart();
    expect(session.tower.seed).toBe(222);
    session.restart(true);
    expect(session.tower.seed).toBe(222);
    expect(seedLabel(222)).toBe("#000222");
    expect(autoplay(new MonkSession("random", 222)).seed).toBe(222);
  });
  it("D4 每層的代表元素", () => {
    for (const layout of layoutsOf(1)) expect([layout.puddles.length, layout.holes.length, layout.beams.length, layout.platform]).toEqual([1, 0, 0, null]);
    for (const layout of layoutsOf(2)) {
      expect(layout.platform).not.toBeNull();
      expect([layout.platform!.low.kind, layout.platform!.high.kind]).toContain("steps");
      expect(layout.puddles).toHaveLength(2);
    }
    for (const layout of layoutsOf(3)) {
      expect(layout.holes.length).toBeGreaterThan(0);
      expect(layout.beams.every((b) => b.kind === "rect")).toBe(true);
    }
    for (const layout of layoutsOf(4)) {
      expect(layout.beams.some((b) => b.kind === "diag")).toBe(true);
      expect(layout.noOuterRail).toBe(true);
    }
    for (const layout of layoutsOf(5)) {
      expect(layout.beams).toHaveLength(2);
      expect(layout.puddles.length).toBeGreaterThan(0);
    }
  });
  it("D5 D6 每種版型（含翻轉）都有一條寬 0.85 以上的路從起點通到樓梯口；橫樑本身就是 0.85 寬", () => {
    expect(TOWER.minWidth).toBe(0.85);
    for (const layout of allLayouts()) {
      expect(findRoute(layout, clearanceGrid(layout)), layout.id).not.toBeNull();
      for (const beam of layout.beams) {
        const width = beam.kind === "rect" ? Math.min(beam.x1 - beam.x0, beam.z1 - beam.z0) : beam.w;
        expect(width, layout.id).toBeGreaterThanOrEqual(0.85 - 1e-9);
      }
    }
    expect(CLEARANCE * 2).toBeGreaterThanOrEqual(0.82);
  });
  it("D6 標準畫法的平滑路線每一點都在可走地面上", () => {
    for (const layout of allLayouts()) {
      const path = buildPath([layout.start, ...line(layout)]);
      for (let s = 0; s <= path.length; s += 0.05) {
        const p = sampleAt(path, s);
        expect(walkable(layout, p), `${layout.id}${layout.flipped ? "'" : ""} @ ${s.toFixed(2)}`).toBe(true);
      }
    }
  });
  it("D7 起點、樓梯口、路線區域在畫線鏡頭下都在 390×844 的安全區內", () => {
    for (const layout of allLayouts()) {
      const camera = drawCamera(layout.flipped);
      const id = `${layout.id}${layout.flipped ? "'" : ""}`;
      expect(inSafeArea(project(camera, [layout.start.x, 1.2, layout.start.z])), `${id} start`).toBe(true);
      expect(inSafeArea(project(camera, [layout.goal.x, 0, layout.goal.z])), `${id} goal`).toBe(true);
      for (const r of routeRegion(layout))
        for (const [x, z] of [
          [r.x0, r.z0],
          [r.x1, r.z0],
          [r.x0, r.z1],
          [r.x1, r.z1],
        ] as const)
          expect(inSafeArea(project(camera, [x, 0, z])), `${id} (${x}, ${z})`).toBe(true);
    }
  });
  it("D8 種子相同，產生的塔完全相同", () => {
    expect(randomTower(98765)).toEqual(randomTower(98765));
    expect(randomTower(98765)).not.toEqual(randomTower(98766));
  });
});

describe("F 鏡頭", () => {
  it("F4 畫線鏡頭：(6.9, 22, 12.5) 看向 (2.3, −0.5, 1.2)，垂直視角 39°；翻轉的版型左右對稱", () => {
    expect(drawCamera(false)).toEqual({ pos: [6.9, 22, 12.5], target: [2.3, -0.5, 1.2], fov: 39 });
    expect(drawCamera(true)).toEqual({ pos: [-6.9, 22, 12.5], target: [-2.3, -0.5, 1.2], fov: 39 });
  });
  it("F5 走路鏡頭：和尚後方 2.8、內側 0.9、高 3.9，垂直視角 58°", () => {
    // 在前廊往 +x 走：內側是 −z（塔身那一側）
    const camera = walkCamera({ x: 2, z: 4, tx: 1, tz: 0, kappa: 0 }, { x: 3.4, z: 4 });
    expect(camera.pos[0]).toBeCloseTo(2 - 2.8, 9);
    expect(camera.pos[1]).toBeCloseTo(3.9, 9);
    expect(camera.pos[2]).toBeCloseTo(4 - 0.9, 9);
    expect(camera.fov).toBe(58);
    expect(camera.target).toEqual([3.4, -0.3, 4]);
  });
});

describe("G 動畫", () => {
  it("G1 G5 過層 1.6 秒、肩後 0.4 秒、層數牌 0.3／0.8／0.3 秒", () => {
    expect(CAMERA.climbSeconds).toBe(1.6);
    expect(CAMERA.toWalkSeconds).toBe(0.4);
    const session = new MonkSession("fixed");
    let ticks = 0;
    while (session.phase === "intro") {
      session.update(1000 / 60);
      ticks++;
    }
    expect(ticks).toBeGreaterThanOrEqual(95);
    expect(ticks).toBeLessThanOrEqual(97);
  });
  it("G6 遊戲中途切換減少動態效果：之後的結局動畫照新的設定", () => {
    const session = atDraw(new MonkSession("fixed", null, false));
    session.setReduced(true);
    session.setLine([...straight(session.layout.start, { x: session.layout.start.x, z: 6.5 }), session.layout.goal]);
    session.setHolding(true);
    for (let i = 0; i < 2000 && session.phase !== "over"; i++) session.update(50);
    expect(session.result?.outcome).toBe("fall");
  });

  it("G7 減少動態效果不影響判定：同一局的湯量、時間、得分相同", () => {
    const a = autoplay(new MonkSession("random", 4242, false));
    const b = autoplay(new MonkSession("random", 4242, true));
    expect(b).toEqual(a);
  });
});

describe("翻轉", () => {
  it("翻轉後的地面判定是鏡像的", () => {
    for (const layout of LAYOUTS.flat()) {
      const flipped = flipLayout(layout);
      for (let x = -5; x <= 5; x += 0.37)
        for (let z = -5; z <= 5; z += 0.41) {
          expect(walkable(flipped, { x: -x, z }), layout.id).toBe(walkable(layout, { x, z }));
          expect(groundAt(flipped, { x: -x, z }).height, layout.id).toBeCloseTo(groundAt(layout, { x, z }).height, 9);
        }
    }
  });
  it("自動駕駛在固定關卡與隨機的塔都能送到塔頂", () => {
    expect(autoplay(new MonkSession("fixed")).outcome).toBe("summit");
    for (const seed of [1, 77, 2024, 999_999]) expect(autoplay(new MonkSession("random", seed)).outcome, String(seed)).toBe("summit");
  });
});

describe("湯漬與溫度事件", () => {
  it("溫度掉到 50℃ 以下時發一次 cold 事件", () => {
    const session = atDraw(new MonkSession("fixed"));
    let cold = 0;
    for (let i = 0; i < 1100; i++) for (const e of session.update(100)) if (e.type === "cold") cold++;
    expect(session.temperature).toBeLessThan(TEMP.cold);
    expect(cold).toBe(1);
  });
  it("一直灑的時候湯漬每隔 0.45 單位一灘，一層最多 24 灘", () => {
    const sim: FloorSim = simOf(dry, straight(dry.start, { x: 4.5, z: 4 }));
    for (let i = 0; i < 400 && !sim.done; i++) {
      sim.lat = 0.6;
      stepFloor(sim, true);
    }
    expect(sim.decals.length).toBeGreaterThan(3);
    expect(sim.decals.length).toBeLessThanOrEqual(DECAL.maxPerFloor);
    for (let i = 1; i < sim.decals.length; i++) expect(Math.hypot(sim.decals[i]!.x - sim.decals[i - 1]!.x, sim.decals[i]!.z - sim.decals[i - 1]!.z)).toBeGreaterThanOrEqual(DECAL.spacing - 1e-9);
  });
});
