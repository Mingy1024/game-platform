import { STATIONS_PER_RUN, TARGET_TIME_SLACK } from "./config";
import { runAutopilot } from "./autopilot";
import { startDistance, type Conditions } from "./physics";
import { createRng, hashSeed, type Rng } from "./rng";
import { STATION_IDS, type StationId } from "./stations";

export type Mode = "daily" | "free";

export type RouteStop = Conditions & {
  station: StationId;
  /** 目標時間（秒，一位小數） */
  targetTime: number;
  /** 出發時離標線的距離（公尺） */
  startDistance: number;
};

export type Route = {
  mode: Mode;
  /** 今日挑戰是台灣日期（YYYY-MM-DD），自由模式是 null */
  dateKey: string | null;
  seed: number;
  stops: RouteStop[];
};

type Tier = {
  speed: [number, number];
  /** 坡度可選的大小（百分比）；0 代表平地 */
  grades: number[];
  rainChance: number;
};

/** 每站的難度範圍，對應驗收標準 D2 */
export const TIERS: Tier[] = [
  { speed: [35, 45], grades: [0], rainChance: 0 },
  { speed: [45, 55], grades: [0, 1], rainChance: 0 },
  { speed: [50, 60], grades: [1.5, 2, 2.5], rainChance: 0.3 },
  { speed: [55, 70], grades: [2, 2.5, 3], rainChance: 0.5 },
  { speed: [65, 75], grades: [2, 2.5, 3], rainChance: 0.5 },
];

function rollConditions(tier: Tier, rng: Rng): Conditions {
  const speedKmh = rng.int(tier.speed[0], tier.speed[1]);
  const magnitude = rng.pick(tier.grades);
  const sign = magnitude === 0 ? 0 : rng.chance(0.5) ? 1 : -1;
  const rain = tier.rainChance > 0 && rng.chance(tier.rainChance);
  return { speedKmh, grade: (sign * magnitude) / 100, rain };
}

/** 目標時間：自動駕駛的理想時間加上餘裕，無條件進位到 0.1 秒 */
export function targetTimeFor(conditions: Conditions): number {
  const ideal = runAutopilot(conditions).elapsed;
  return Math.ceil(ideal * TARGET_TIME_SLACK * 10) / 10;
}

/** 由種子產生一局 5 站。同一個種子永遠得到同一條路線。 */
export function generateRoute(seed: number, mode: Mode, dateKey: string | null = null): Route {
  const rng = createRng(seed);
  const stations = rng.shuffle(STATION_IDS).slice(0, STATIONS_PER_RUN);
  const conditions = TIERS.map((tier) => rollConditions(tier, rng));
  // 第 3–5 站至少要有一站雨天
  if (!conditions.slice(2).some((item) => item.rain)) {
    conditions[rng.int(2, STATIONS_PER_RUN - 1)].rain = true;
  }
  const stops = conditions.map((item, index) => ({
    ...item,
    station: stations[index],
    targetTime: targetTimeFor(item),
    startDistance: startDistance(item),
  }));
  return { mode, dateKey, seed, stops };
}

/** 台灣日期（UTC+8，沒有日光節約時間），格式 YYYY-MM-DD */
export function taiwanDateKey(now: Date | number = Date.now()): string {
  const ms = typeof now === "number" ? now : now.getTime();
  return new Date(ms + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

export function dailySeed(dateKey: string): number {
  return hashSeed(`precise-stop:daily:${dateKey}`);
}

export function dailyRoute(dateKey: string = taiwanDateKey()): Route {
  return generateRoute(dailySeed(dateKey), "daily", dateKey);
}

export function freeRoute(seed: number = Math.floor(Math.random() * 0xffffffff)): Route {
  return generateRoute(seed >>> 0, "free", null);
}

/** 坡度的方向：給介面選文字和圖示 */
export function gradeKind(grade: number): "flat" | "up" | "down" {
  if (grade === 0) return "flat";
  return grade > 0 ? "up" : "down";
}
