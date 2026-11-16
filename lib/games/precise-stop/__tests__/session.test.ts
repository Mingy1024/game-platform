import { describe, expect, it } from "vitest";
import { FX, PHYSICS } from "../config";
import { dailyRoute } from "../route";
import { GameSession, type SessionEvent } from "../session";

const route = dailyRoute("2026-11-15");
const FRAME = 1 / 60;

function playStation(session: GameSession) {
  session.depart();
  let guard = 0;
  while (session.getSnapshot().phase === "running" && guard++ < 60 * 600) session.update(FRAME);
}

function playAll() {
  const session = new GameSession(route);
  session.autopilot = true;
  const events: SessionEvent[] = [];
  session.onEvent((event) => events.push(event));
  for (let i = 0; i < 5; i++) {
    playStation(session);
    session.next();
  }
  return { session, events };
}

describe("F1 流程", () => {
  it("站點介紹 → 行駛 → 判定 → 下一站 → 結算", () => {
    const session = new GameSession(route);
    session.autopilot = true;
    expect(session.getSnapshot().phase).toBe("briefing");
    session.update(1);
    expect(session.getSnapshot().train.distance).toBe(route.stops[0].startDistance);

    for (let index = 0; index < 5; index++) {
      expect(session.getSnapshot()).toMatchObject({ phase: "briefing", index });
      session.depart();
      expect(session.getSnapshot().phase).toBe("running");
      let guard = 0;
      while (session.getSnapshot().phase === "running" && guard++ < 60 * 600) session.update(FRAME);
      expect(session.getSnapshot().phase).toBe("judged");
      expect(session.getSnapshot().results).toHaveLength(index + 1);
      session.next();
    }
    expect(session.getSnapshot().phase).toBe("final");
    expect(session.getSnapshot().total).toBe(6000);
  });

  it("依序發出出發、放大、停下、判定、結算事件", () => {
    const { events } = playAll();
    const firstStation = events.filter((event) => !("index" in event) || event.index === 0);
    expect(firstStation.map((event) => event.type).slice(0, 4)).toEqual([
      "depart",
      "zoom",
      "stopped",
      "judged",
    ]);
    expect(events.at(-1)).toEqual({ type: "final", total: 6000 });
    expect(events.filter((event) => event.type === "judged")).toHaveLength(5);
  });

  it("剩 5 m 時進入近站放大（F6）", () => {
    const session = new GameSession(route);
    session.autopilot = true;
    session.depart();
    while (session.getSnapshot().train.distance > FX.zoomAt + 0.5) session.update(FRAME);
    expect(session.getSnapshot().zoomed).toBe(false);
    while (session.getSnapshot().train.distance > FX.zoomAt - 0.2) session.update(FRAME);
    expect(session.getSnapshot().zoomed).toBe(true);
  });

  it("Enter 鍵依階段出發或前往下一站", () => {
    const session = new GameSession(route);
    session.autopilot = true;
    session.advance();
    expect(session.getSnapshot().phase).toBe("running");
    session.advance();
    expect(session.getSnapshot().phase).toBe("running");
    while (session.getSnapshot().phase === "running") session.update(FRAME);
    session.advance();
    expect(session.getSnapshot()).toMatchObject({ phase: "briefing", index: 1 });
  });
});

describe("B5 結果和畫面更新率無關", () => {
  it("用 30、60、144 fps 更新，同樣的操作得到同樣的結果", () => {
    const errors = [1 / 30, 1 / 60, 1 / 144].map((frame) => {
      const session = new GameSession(route);
      session.depart();
      let time = 0;
      while (session.getSnapshot().phase === "running" && time < 120) {
        // 第 3 秒開始按住不放
        session.setBrake(time >= 3);
        session.update(frame);
        time += frame;
      }
      return session.getSnapshot().results[0].error;
    });
    // 按下煞車的時間點最多差一個畫面，允許 1/30 秒 × 車速的誤差
    const tolerance = (route.stops[0].speedKmh / 3.6) * (1 / 30) + 0.01;
    expect(Math.abs(errors[0] - errors[1])).toBeLessThan(tolerance);
    expect(Math.abs(errors[1] - errors[2])).toBeLessThan(tolerance);
  });

  it("自動駕駛在任何更新率都得到完全相同的結果", () => {
    const totals = [1 / 30, 1 / 60, 1 / 144].map((frame) => {
      const session = new GameSession(route);
      session.autopilot = true;
      session.depart();
      while (session.getSnapshot().phase === "running") session.update(frame);
      return session.getSnapshot().results[0];
    });
    expect(totals[0]).toEqual(totals[1]);
    expect(totals[1]).toEqual(totals[2]);
  });
});

describe("E3 暫停", () => {
  it("暫停時時間不前進，繼續時煞車力歸零", () => {
    const session = new GameSession(route);
    session.depart();
    session.setBrake(true);
    for (let i = 0; i < 30; i++) session.update(FRAME);
    expect(session.getSnapshot().train.brake).toBeGreaterThan(0.9);

    session.pause();
    const frozen = session.getSnapshot().train.distance;
    for (let i = 0; i < 60; i++) session.update(FRAME);
    expect(session.getSnapshot()).toMatchObject({ paused: true, braking: false });
    expect(session.getSnapshot().train.distance).toBe(frozen);

    session.resume();
    expect(session.getSnapshot().train.brake).toBe(0);
    expect(session.getSnapshot().braking).toBe(false);
  });

  it("暫停時不能出發或前往下一站", () => {
    const session = new GameSession(route);
    session.pause();
    session.depart();
    expect(session.getSnapshot().phase).toBe("briefing");
  });
});

describe("F10 重新開始", () => {
  it("回到第 1 站，分數和連擊歸零，路線不變", () => {
    const { session } = playAll();
    session.restart();
    expect(session.getSnapshot()).toMatchObject({
      phase: "briefing",
      index: 0,
      results: [],
      total: 0,
      streak: 0,
      paused: false,
    });
    expect(session.route).toBe(route);
  });
});

describe("失誤後繼續（C5）", () => {
  it("完全不煞車會過站、得 0 分，遊戲繼續到下一站", () => {
    const session = new GameSession(route);
    session.depart();
    let guard = 0;
    while (session.getSnapshot().phase === "running" && guard++ < 60 * 900) session.update(FRAME);
    const [result] = session.getSnapshot().results;
    expect(result.judgement).toBe("miss");
    expect(result.score).toBe(0);
    expect(result.error).toBeGreaterThan(PHYSICS.overrunLimit);
    session.next();
    expect(session.getSnapshot()).toMatchObject({ phase: "briefing", index: 1, streak: 0 });
  });

  it("誤差量到公釐", () => {
    const { session } = playAll();
    for (const result of session.getSnapshot().results) {
      expect(Math.abs(result.error * 1000 - Math.round(result.error * 1000))).toBeLessThan(1e-6);
    }
  });
});
