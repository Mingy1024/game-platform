import { describe, expect, it } from "vitest";
import { dailyRoute, dailySeed, freeRoute, generateRoute, taiwanDateKey, TIERS } from "../route";
import { STATION_IDS, stationBackground, stationName } from "../stations";

const SEEDS = Array.from({ length: 400 }, (_, index) => (index + 1) * 104729);

describe("D1 站數", () => {
  it("一局固定 5 站", () => {
    for (const seed of SEEDS) expect(generateRoute(seed, "free").stops).toHaveLength(5);
  });
});

describe("D2 各站難度範圍", () => {
  it("速度、坡度都在規定範圍內", () => {
    const expected = [
      { speed: [35, 45], grades: [0] },
      { speed: [45, 55], grades: [0, 1] },
      { speed: [50, 60], grades: [1.5, 2, 2.5] },
      { speed: [55, 70], grades: [2, 2.5, 3] },
      { speed: [65, 75], grades: [2, 2.5, 3] },
    ];
    expect(TIERS.map(({ speed, grades }) => ({ speed, grades }))).toEqual(expected);
    for (const seed of SEEDS) {
      generateRoute(seed, "free").stops.forEach((stop, index) => {
        const tier = expected[index];
        expect(stop.speedKmh).toBeGreaterThanOrEqual(tier.speed[0]);
        expect(stop.speedKmh).toBeLessThanOrEqual(tier.speed[1]);
        expect(tier.grades).toContain(Math.round(Math.abs(stop.grade) * 1000) / 10);
      });
    }
  });

  it("第 1、2 站一定是晴天，第 1 站一定是平地", () => {
    for (const seed of SEEDS) {
      const [first, second] = generateRoute(seed, "free").stops;
      expect(first.rain).toBe(false);
      expect(first.grade).toBe(0);
      expect(second.rain).toBe(false);
    }
  });

  it("雨天機率大致符合：第 3 站約 30%，第 4、5 站約 50%", () => {
    const routes = SEEDS.map((seed) => generateRoute(seed, "free"));
    const rate = (index: number) =>
      routes.filter((route) => route.stops[index].rain).length / routes.length;
    // 「至少一站雨天」的補正會把機率稍微往上推
    expect(rate(2)).toBeGreaterThan(0.25);
    expect(rate(2)).toBeLessThan(0.5);
    expect(rate(3)).toBeGreaterThan(0.4);
    expect(rate(3)).toBeLessThan(0.7);
    expect(rate(4)).toBeGreaterThan(0.4);
    expect(rate(4)).toBeLessThan(0.7);
  });

  it("上坡和下坡都會出現", () => {
    const grades = SEEDS.flatMap((seed) => generateRoute(seed, "free").stops.map((s) => s.grade));
    expect(grades.some((grade) => grade > 0)).toBe(true);
    expect(grades.some((grade) => grade < 0)).toBe(true);
  });

  it("目標時間比理想時間寬鬆，而且是 0.1 秒的倍數", () => {
    for (const stop of generateRoute(12345, "free").stops) {
      expect(stop.targetTime).toBeGreaterThan(5);
      expect(Math.abs(stop.targetTime * 10 - Math.round(stop.targetTime * 10))).toBeLessThan(1e-9);
    }
  });
});

describe("D3 雨天", () => {
  it("第 3–5 站至少有一站是雨天", () => {
    for (const seed of SEEDS) {
      expect(generateRoute(seed, "free").stops.slice(2).some((stop) => stop.rain)).toBe(true);
    }
  });
});

describe("D4 今日挑戰", () => {
  it("同一個台灣日期產生完全相同的路線", () => {
    expect(dailyRoute("2026-11-15")).toEqual(dailyRoute("2026-11-15"));
    expect(dailyRoute("2026-11-15").dateKey).toBe("2026-11-15");
    expect(dailyRoute("2026-11-15").mode).toBe("daily");
  });

  it("不同日期的路線不同", () => {
    expect(dailySeed("2026-11-15")).not.toBe(dailySeed("2026-11-16"));
    expect(dailyRoute("2026-11-15").stops).not.toEqual(dailyRoute("2026-11-16").stops);
  });

  it("以台灣時間 0 點換日", () => {
    // 台灣時間 2026-11-15 23:59:59 = UTC 15:59:59
    expect(taiwanDateKey(Date.UTC(2026, 10, 15, 15, 59, 59))).toBe("2026-11-15");
    // 台灣時間 2026-11-16 00:00:00 = UTC 16:00:00
    expect(taiwanDateKey(Date.UTC(2026, 10, 15, 16, 0, 0))).toBe("2026-11-16");
    expect(taiwanDateKey(new Date("2026-12-31T16:00:00Z"))).toBe("2027-01-01");
  });
});

describe("D5 自由模式", () => {
  it("和今日挑戰用同一套產生器，只差在種子", () => {
    const seed = dailySeed("2026-11-15");
    expect(freeRoute(seed).stops).toEqual(dailyRoute("2026-11-15").stops);
    expect(freeRoute(seed).mode).toBe("free");
    expect(freeRoute(seed).dateKey).toBeNull();
  });

  it("沒給種子時每局不同", () => {
    const seeds = new Set(Array.from({ length: 20 }, () => freeRoute().seed));
    expect(seeds.size).toBeGreaterThan(15);
  });
});

describe("D6 站名", () => {
  it("只從 7 個站名取用，同一局不重複", () => {
    expect(STATION_IDS).toHaveLength(7);
    for (const seed of SEEDS) {
      const stations = generateRoute(seed, "free").stops.map((stop) => stop.station);
      expect(new Set(stations).size).toBe(5);
      for (const station of stations) expect(STATION_IDS).toContain(station);
    }
  });

  it("每個站名都會被用到", () => {
    const used = new Set(
      SEEDS.flatMap((seed) => generateRoute(seed, "free").stops.map((stop) => stop.station)),
    );
    expect(used.size).toBe(7);
  });

  it("每個站名對應固定的背景", () => {
    expect(new Set(STATION_IDS.map(stationBackground)).size).toBe(7);
    expect(stationBackground("sakurazaka")).toBe("bg-sakurazaka.webp");
  });

  it("漢字語言顯示漢字，其他語言顯示音譯（K7）", () => {
    expect(stationName("sakurazaka", "zh-TW")).toEqual({ name: "櫻坂", sub: "Sakurazaka" });
    expect(stationName("sakurazaka", "zh-CN").name).toBe("樱坂");
    expect(stationName("sakurazaka", "ja").name).toBe("桜坂");
    expect(stationName("sakurazaka", "ko").name).toBe("사쿠라자카");
    for (const locale of ["en", "vi", "pt"]) {
      expect(stationName("kitawan", locale)).toEqual({ name: "Kitawan", sub: "北灣" });
    }
  });
});
