import { describe, expect, it } from "vitest";
import { dailyRoute } from "../route";
import { GameSession } from "../session";
import { decodeRun, encodeRun, toSharedRun, type SharedRun } from "../share-code";

const sample: SharedRun = {
  mode: "daily",
  dateKey: "2026-11-15",
  newRecord: true,
  stops: [
    { station: "aoba", errorMm: -20, overtimeTenths: 0 },
    { station: "kawaguchi", errorMm: 120, overtimeTenths: 0 },
    { station: "sakurazaka", errorMm: -210, overtimeTenths: 0 },
    { station: "kitawan", errorMm: 640, overtimeTenths: 12 },
    { station: "hoshimi", errorMm: 40, overtimeTenths: 0 },
  ],
};

describe("J7 成績代碼", () => {
  it("編碼後解得回來，分數用同一套規則重算", () => {
    const code = encodeRun(sample);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(code.length).toBeLessThanOrEqual(48);
    const decoded = decodeRun(code);
    expect(decoded).toMatchObject({ mode: "daily", dateKey: "2026-11-15", newRecord: true });
    expect(decoded?.stops).toEqual(sample.stops);
    expect(decoded?.results.map((result) => result.score)).toEqual([1000, 1046, 1080, 620, 1000]);
    expect(decoded?.total).toBe(4746);
  });

  it("自由模式、沒破紀錄也能正確還原", () => {
    const decoded = decodeRun(encodeRun({ ...sample, mode: "free", newRecord: false }));
    expect(decoded).toMatchObject({ mode: "free", newRecord: false });
  });

  it("實際玩出來的結果，解碼後總分完全一致", () => {
    const route = dailyRoute("2026-11-15");
    const session = new GameSession(route);
    session.depart();
    let time = 0;
    // 故意操作得不完美：每站在不同時間點開始按住
    for (let index = 0; index < 5; index++) {
      const brakeAt = 2 + index * 1.7;
      let local = 0;
      while (session.getSnapshot().phase === "running" && local < 400) {
        session.setBrake(local > brakeAt && Math.floor(local * 3) % 4 !== 0);
        session.update(1 / 60);
        local += 1 / 60;
        time += 1 / 60;
      }
      session.next();
      session.depart();
    }
    const snapshot = session.getSnapshot();
    expect(snapshot.results).toHaveLength(5);
    const decoded = decodeRun(
      encodeRun(
        toSharedRun({
          mode: "daily",
          dateKey: "2026-11-15",
          newRecord: false,
          stations: route.stops.map((stop) => stop.station),
          results: snapshot.results,
        }),
      ),
    );
    expect(decoded?.total).toBe(snapshot.total);
    expect(decoded?.results.map((r) => r.judgement)).toEqual(snapshot.results.map((r) => r.judgement));
    expect(time).toBeGreaterThan(0);
  });

  it("亂改或格式不對的代碼回傳 null，不會丟錯誤", () => {
    const code = encodeRun(sample);
    const tampered = code.slice(0, 10) + (code[10] === "A" ? "B" : "A") + code.slice(11);
    for (const bad of [
      "",
      "abc",
      "!!!!",
      "../../etc/passwd",
      "a".repeat(40),
      "a".repeat(500),
      code.slice(0, -2),
      `${code}AA`,
      tampered,
      "%E4%B8%AD%E6%96%87",
    ]) {
      expect(decodeRun(bad)).toBeNull();
    }
    expect(decodeRun(undefined as unknown as string)).toBeNull();
  });

  it("誤差太大時夾在上限，仍然是失誤", () => {
    const decoded = decodeRun(
      encodeRun({
        ...sample,
        stops: sample.stops.map((stop, index) => (index === 0 ? { ...stop, errorMm: 99999 } : stop)),
      }),
    );
    expect(decoded?.results[0]).toMatchObject({ judgement: "miss", score: 0 });
  });
});
