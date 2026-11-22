import { createRng, hashSeed, type Rng } from "../precise-stop/rng";
import {
  LANES,
  MOVE,
  ROW_INTERVAL_SECONDS,
  SEGMENTS,
  SEGMENT_COUNT,
  SEGMENT_LENGTH_RATIO,
  STORY_LINES_PER_POOL,
  type Lane,
} from "./config";

/** 台灣日期（UTC+8，沒有日光節約時間），格式 YYYY-MM-DD；兩款遊戲共用同一個定義 */
export { taiwanDateKey } from "../precise-stop/route";

export type ObstacleKind = "chatter" | "box" | "chair" | "copier" | "cart" | "commuter";
export const JUMPABLE: ReadonlySet<ObstacleKind> = new Set(["box", "chair"]);

export type Obstacle = { id: number; segment: number; z: number; lane: Lane; kind: ObstacleKind; variant: 0 | 1 };
/** 主管視線區：z0 起往前 length 公尺；視線每 stepSeconds 秒換一條線 */
export type GazeZone = { id: number; segment: number; z: number; length: number; phase: number };
/** 電梯門列：經過時只有「現在開著」的那條線能過，其餘要等 4 秒 */
export type DoorRow = { id: number; segment: number; z: number; phase: number };
export type EventSpot = { segment: number; z: number; pool: LinePool };
export type LinePool = "coworker" | "boss" | "group";
export type ItemKind = "coffee" | "headphones" | "dnd";
export type Item = { id: number; segment: number; z: number; lane: Lane; kind: ItemKind };

/** 路線的固定部分：每局都一樣，可以背路線（第 7 題） */
export type Layout = {
  /** 各段的起點 z 與長度（公尺） */
  segments: { start: number; length: number; speed: number }[];
  total: number;
  obstacles: Obstacle[];
  gazes: GazeZone[];
  doors: DoorRow[];
  events: EventSpot[];
  /** 讀卡機（第 4 段，只有音效與畫面，不影響判定，B16） */
  readerZ: number;
  /** 道具的位置（不含線）；線每局隨機 */
  itemSlots: { id: number; segment: number; z: number; kind: ItemKind }[];
};

/** 電梯門每條線開著的秒數（循環 3 條線輪流開） */
export const DOOR_STEP_SECONDS = 1.2;
/** 主管視線每條線停留的秒數 */
export const GAZE_STEP_SECONDS = 1.5;
export const GAZE_LENGTH = 8;

export const segmentSpeed = (segment: number) => MOVE.baseSpeed * MOVE.segmentSpeedUp ** segment;

const LAYOUT_SEED = hashSeed("office-escape:layout:v1");
const POOLS: ObstacleKind[][] = [
  ["chatter", "box", "chair", "box"],
  ["copier", "chatter", "box", "copier"],
  ["cart", "chatter", "cart", "box"],
  ["commuter", "cart", "commuter", "chair"],
];
/** 兩條線都被擋的機率 */
const DOUBLE = [0.25, 0.3, 0.4, 0.45];
/** 每段放哪些道具（B13、第 6 題）；道具所在的線每局隨機，數量固定 */
const ITEM_PLAN: ItemKind[][] = [
  ["coffee", "headphones"],
  ["headphones", "dnd"],
  ["coffee", "dnd"],
  ["coffee"],
];

function buildLayout(): Layout {
  const rng = createRng(LAYOUT_SEED);
  const segments: Layout["segments"] = [];
  let start = 0;
  for (let i = 0; i < SEGMENT_COUNT; i++) {
    const speed = segmentSpeed(i);
    const length = Math.round(speed * SEGMENTS[i].target * SEGMENT_LENGTH_RATIO * 2) / 2;
    segments.push({ start, length, speed });
    start += length;
  }
  const layout: Layout = { segments, total: start, obstacles: [], gazes: [], doors: [], events: [], readerZ: 0, itemSlots: [] };
  let nextId = 1;
  const keepClear: { from: number; to: number }[] = [];

  // 特殊設施
  const seg2 = segments[1];
  for (const ratio of [0.3, 0.65]) {
    const z = seg2.start + Math.round(seg2.length * ratio);
    layout.gazes.push({ id: nextId++, segment: 1, z, length: GAZE_LENGTH, phase: layout.gazes.length * 2 });
    keepClear.push({ from: z - 4, to: z + GAZE_LENGTH + 4 });
  }
  const seg3 = segments[2];
  for (const ratio of [0.25, 0.5, 0.78]) {
    const z = seg3.start + Math.round(seg3.length * ratio);
    layout.doors.push({ id: nextId++, segment: 2, z, phase: layout.doors.length });
    keepClear.push({ from: z - 4, to: z + 4 });
  }
  const seg1 = segments[0];
  layout.events.push({ segment: 0, z: seg1.start + Math.round(seg1.length * 0.55), pool: "coworker" });
  layout.events.push({ segment: 2, z: seg3.start + Math.round(seg3.length * 0.4), pool: "group" });
  // 第 2 段的突發事件在主管視線接觸時觸發，這裡不放固定位置
  // 事件放慢到 20%，玩家在這幾公尺內還在前進，不放障礙
  for (const spot of layout.events) keepClear.push({ from: spot.z - 3, to: spot.z + 8 });
  const seg4 = segments[3];
  layout.readerZ = seg4.start + Math.round(seg4.length * 0.45);

  const blocked = (z: number) => keepClear.some((range) => z >= range.from && z <= range.to);

  for (let i = 0; i < SEGMENT_COUNT; i++) {
    const { start: s, length, speed } = segments[i];
    const spacing = speed * ROW_INTERVAL_SECONDS[i];
    const rowZs: number[] = [];
    for (let z = s + 12; z <= s + length - 14; z += spacing) {
      const rounded = Math.round(z * 2) / 2;
      if (!blocked(rounded)) rowZs.push(rounded);
    }
    for (const z of rowZs) {
      const count = rng.chance(DOUBLE[i]) ? 2 : 1;
      const lanes = rng.shuffle([...LANES]).slice(0, count);
      for (const lane of lanes) {
        layout.obstacles.push({ id: nextId++, segment: i, z, lane, kind: rng.pick(POOLS[i]), variant: rng.chance(0.5) ? 1 : 0 });
      }
    }
    // 道具放在列與列的中間
    const plan = ITEM_PLAN[i];
    for (let k = 0; k < plan.length; k++) {
      const index = Math.min(rowZs.length - 2, Math.floor(((k + 1) * rowZs.length) / (plan.length + 1)));
      const z = Math.round((rowZs[Math.max(0, index)] + spacing / 2) * 2) / 2;
      layout.itemSlots.push({ id: nextId++, segment: i, z, kind: plan[k] });
    }
  }
  return layout;
}

/** 固定路線（模組載入時算一次；每局都一樣） */
export const LAYOUT: Layout = buildLayout();

export type Dialogue = {
  pool: LinePool;
  /** 這個台詞庫裡的第幾句（0 起算，詞庫共 20 句） */
  line: number;
  /** 畫面上三個選項的順序：order[顯示位置] = 0 最佳、1 普通、2 錯誤 */
  order: [number, number, number];
};

/** 每局隨機的部分：台詞和道具所在的線（D3）；種子記在成績裡，同一個種子重現同一局（D4） */
export type Run = {
  seed: number;
  items: Item[];
  /** 三個台詞庫各抽一句（D5）：座位區、主管視線、電梯廳 */
  dialogues: Record<LinePool, Dialogue>;
};

export function rollRun(seed: number): Run {
  const rng: Rng = createRng(seed >>> 0);
  const items = LAYOUT.itemSlots.map((slot) => ({ ...slot, lane: rng.pick(LANES) }));
  const pools: LinePool[] = ["coworker", "boss", "group"];
  const dialogues = {} as Run["dialogues"];
  for (const pool of pools) {
    dialogues[pool] = {
      pool,
      line: rng.int(0, STORY_LINES_PER_POOL - 1),
      order: rng.shuffle([0, 1, 2]) as [number, number, number],
    };
  }
  return { seed: seed >>> 0, items, dialogues };
}

export const randomSeed = () => Math.floor(Math.random() * 0xffffffff) >>> 0;

/** 現在開著的電梯門在哪條線 */
export function openDoorLane(door: DoorRow, clockSeconds: number): Lane {
  return LANES[(Math.floor(clockSeconds / DOOR_STEP_SECONDS) + door.phase) % 3];
}

/** 主管現在看著哪條線 */
export function gazeLane(zone: GazeZone, clockSeconds: number): Lane {
  return LANES[(Math.floor(clockSeconds / GAZE_STEP_SECONDS) + zone.phase) % 3];
}
