import { createRng } from "../precise-stop/rng";
import { makeRow, zoneIndex, type PlatformSpec } from "./course";
import { CEILING, FIELD, HEALTH, LAYER, PLATFORM, PLAYER, SCORE, SPEED_RAMP, STEP, ZONES, type Kind } from "./config";

/**
 * 一路向下的模擬（B、C、D 組）：固定步長，相同種子加上相同操作一定得到相同結果（B12）。
 * 座標：x 往右、y 往下，單位公尺；岩板以每秒 speed 公尺往上捲，玩家站在上面或落下。
 * 純邏輯，不碰 Phaser、DOM、時間或隨機（種子由外面給）。
 */
export type PlatformState = "idle" | "cracking" | "falling";
export type Platform = {
  id: number;
  kind: Kind;
  x: number;
  y: number;
  w: number;
  /** 礦軌推車的方向 */
  dir: 1 | -1;
  state: PlatformState;
  timer: number;
  /** 尖刺已經扎過、水晶已經撿走 */
  spent: boolean;
  vy: number;
};

export type OverReason = "hp" | "fall";

export type SimEvent =
  | { type: "land"; kind: Kind; x: number; y: number; vy: number }
  | { type: "hurt"; cause: "spike" | "ceiling"; x: number; y: number }
  | { type: "heal" }
  | { type: "bounce"; x: number; y: number }
  | { type: "crystal"; points: number; x: number; y: number }
  | { type: "graze"; source: "edge" | "ceiling"; points: number; mult: number; x: number; y: number }
  | { type: "crack"; x: number; y: number }
  | { type: "zone"; scene: number }
  | { type: "over"; reason: OverReason };

export type Player = {
  x: number;
  /** 腳底 */
  y: number;
  vx: number;
  vy: number;
  /** 站著的岩板 id；在空中是 null */
  ground: number | null;
  hp: number;
  invuln: number;
  face: -1 | 1;
  regen: number;
  /** 被崩塌線壓到後的保護時間（這段時間不會再被撞一次） */
  squeeze: number;
  /** 被崩塌線壓到時腳下那塊岩板：它還在往上頂，壓下去之後不能馬上又站回去 */
  squeezeSkip: number | null;
  ceilCooldown: number;
};

export type Sim = {
  seed: number;
  time: number;
  scrolled: number;
  depthPaid: number;
  platforms: Platform[];
  player: Player;
  nextId: number;
  nextRow: number;
  lastRowY: number;
  lastAnchor: PlatformSpec | null;
  zone: number;
  parts: { depth: number; graze: number; crystal: number };
  mult: number;
  multTimer: number;
  grazeCount: number;
  grazes: number;
  hits: number;
  over: OverReason | null;
  events: SimEvent[];
};

/** 這個深度的捲動速度（層／秒）：五段，700 m 以後每 100 m 加快、有上限（B10、D5） */
export function scrollLayersPerSecond(depth: number): number {
  const zone = ZONES[zoneIndex(depth)];
  if (zoneIndex(depth) < ZONES.length - 1) return zone.speed;
  const last = ZONES[ZONES.length - 1];
  return Math.min(SPEED_RAMP.max, last.speed + Math.floor((depth - last.from) / 100) * SPEED_RAMP.perHundred);
}

export const ceilingY = (depth: number) => CEILING.base + Math.min(CEILING.max, depth * CEILING.perMeter);

export function createSim(seed: number): Sim {
  const start: Platform = { id: 0, kind: "rock", x: FIELD.width / 2, y: PLAYER.startY, w: 3, dir: 1, state: "idle", timer: 0, spent: false, vy: 0 };
  const sim: Sim = {
    seed: seed >>> 0,
    time: 0,
    scrolled: 0,
    depthPaid: 0,
    platforms: [start],
    player: {
      x: FIELD.width / 2,
      y: PLAYER.startY,
      vx: 0,
      vy: 0,
      ground: 0,
      hp: HEALTH.max,
      invuln: 0,
      face: 1,
      regen: 0,
      squeeze: 0,
      squeezeSkip: null,
      ceilCooldown: 0,
    },
    nextId: 1,
    nextRow: 1,
    lastRowY: PLAYER.startY,
    lastAnchor: { kind: "rock", x: start.x, w: start.w, dir: 1 },
    zone: 0,
    parts: { depth: 0, graze: 0, crystal: 0 },
    mult: 1,
    multTimer: 0,
    grazeCount: 0,
    grazes: 0,
    hits: 0,
    over: null,
    events: [],
  };
  fillRows(sim);
  return sim;
}

export const depthOf = (sim: Sim) => Math.floor(sim.scrolled);
export const totalScore = (sim: Sim) => sim.parts.depth + sim.parts.graze + sim.parts.crystal;

/** 畫面下方還有空位就補上新的一層 */
function fillRows(sim: Sim) {
  while (sim.lastRowY < FIELD.height + LAYER) {
    const y = sim.lastRowY + LAYER;
    const row = makeRow(sim.seed, sim.nextRow, depthOf(sim) + Math.max(0, y - PLAYER.startY), sim.lastAnchor);
    for (const spec of row.platforms) {
      sim.platforms.push({ id: sim.nextId++, kind: spec.kind, x: spec.x, y, w: spec.w, dir: spec.dir, state: "idle", timer: 0, spent: false, vy: 0 });
    }
    sim.lastAnchor = row.platforms[row.anchor];
    sim.lastRowY = y;
    sim.nextRow++;
  }
}

function award(sim: Sim, kind: "depth" | "graze" | "crystal", base: number): number {
  const points = Math.round(base * sim.mult);
  sim.parts[kind] += points;
  return points;
}

function hurt(sim: Sim, cause: "spike" | "ceiling") {
  const p = sim.player;
  if (p.invuln > 0) return;
  p.hp -= 1;
  p.invuln = HEALTH.invulnSeconds;
  p.regen = 0;
  sim.mult = 1;
  sim.multTimer = 0;
  sim.grazeCount = 0;
  sim.hits++;
  sim.events.push({ type: "hurt", cause, x: p.x, y: p.y });
  if (p.hp <= 0) finish(sim, "hp");
}

function finish(sim: Sim, reason: OverReason) {
  if (sim.over) return;
  sim.over = reason;
  sim.events.push({ type: "over", reason });
}

function graze(sim: Sim, source: "edge" | "ceiling", x: number, y: number) {
  sim.grazeCount++;
  sim.grazes++;
  sim.mult = sim.grazeCount >= 2 ? Math.min(SCORE.multMax, SCORE.multStart + SCORE.multStep * (sim.grazeCount - 2)) : 1;
  sim.multTimer = SCORE.multSeconds;
  const points = award(sim, "graze", SCORE.graze);
  sim.events.push({ type: "graze", source, points, mult: sim.mult, x, y });
}

const supports = (p: Platform, x: number) => x >= p.x - p.w / 2 - 0.05 && x <= p.x + p.w / 2 + 0.05;

function land(sim: Sim, platform: Platform, impactVy: number) {
  const p = sim.player;
  p.y = platform.y;
  p.vy = 0;
  p.ground = platform.id;
  p.regen = 0;
  sim.events.push({ type: "land", kind: platform.kind, x: p.x, y: p.y, vy: impactVy });
  if (platform.kind !== "spike") {
    const edge = platform.w / 2 - Math.abs(p.x - platform.x);
    if (edge >= 0 && edge <= platform.w * SCORE.edgeRatio) graze(sim, "edge", p.x, p.y);
  }
  switch (platform.kind) {
    case "spike":
      if (!platform.spent) {
        platform.spent = true;
        hurt(sim, "spike");
        p.vy = -HEALTH.spikeHop;
        p.ground = null;
      }
      break;
    case "crack":
      if (platform.state === "idle") {
        platform.state = "cracking";
        platform.timer = PLATFORM.crackSeconds;
      }
      break;
    case "wood":
      p.vy = -Math.sqrt(2 * PLAYER.gravity * PLATFORM.bounceLayers * LAYER);
      p.ground = null;
      sim.events.push({ type: "bounce", x: p.x, y: p.y });
      break;
    case "crystal":
      if (!platform.spent) {
        platform.spent = true;
        const points = award(sim, "crystal", SCORE.crystal);
        sim.events.push({ type: "crystal", points, x: p.x, y: p.y });
      }
      break;
    default:
      break;
  }
}

/** 走一個固定步長。axis：-1 往左、0 不動、1 往右 */
export function step(sim: Sim, axis: -1 | 0 | 1): void {
  if (sim.over) return;
  const dt = STEP;
  const p = sim.player;
  sim.time += dt;

  // 捲動：所有岩板往上；碎掉的往下掉
  const speed = scrollLayersPerSecond(sim.scrolled) * LAYER;
  sim.scrolled += speed * dt;
  sim.lastRowY -= speed * dt;
  for (const platform of sim.platforms) {
    if (platform.state === "falling") {
      platform.vy = Math.min(PLAYER.maxFall * 1.5, platform.vy + PLAYER.gravity * dt);
      platform.y += platform.vy * dt - speed * dt;
    } else {
      platform.y -= speed * dt;
    }
  }
  sim.platforms = sim.platforms.filter((platform) => platform.y > -1 && platform.y < FIELD.height + LAYER * 3);
  fillRows(sim);

  // 倍率先到期，再算這一步的深度分（到期的那一步不再套用倍率）
  if (sim.multTimer > 0) {
    sim.multTimer -= dt;
    if (sim.multTimer <= 0) {
      sim.multTimer = 0;
      sim.mult = 1;
      sim.grazeCount = 0;
    }
  }
  // 深度分與段落
  const depth = depthOf(sim);
  while (sim.depthPaid < depth) {
    sim.depthPaid++;
    award(sim, "depth", SCORE.perMeter);
  }
  const zone = zoneIndex(sim.scrolled);
  if (zone !== sim.zone) {
    sim.zone = zone;
    sim.events.push({ type: "zone", scene: ZONES[zone].scene });
  }
  if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
  if (p.ceilCooldown > 0) p.ceilCooldown -= dt;
  if (p.squeeze > 0) {
    p.squeeze -= dt;
    if (p.squeeze <= 0) p.squeezeSkip = null;
  }

  // 碎裂計時
  for (const platform of sim.platforms) {
    if (platform.state === "cracking") {
      platform.timer -= dt;
      if (platform.timer <= 0) {
        platform.state = "falling";
        platform.vy = 0;
        sim.events.push({ type: "crack", x: platform.x, y: platform.y });
        if (p.ground === platform.id) p.ground = null;
      }
    }
  }

  // 左右移動
  const target = axis * PLAYER.maxSpeed;
  const rate = axis === 0 ? PLAYER.maxSpeed / PLAYER.stopSeconds : PLAYER.maxSpeed / PLAYER.accelSeconds;
  if (p.vx < target) p.vx = Math.min(target, p.vx + rate * dt);
  else if (p.vx > target) p.vx = Math.max(target, p.vx - rate * dt);
  if (axis !== 0) p.face = axis;
  let ground = p.ground === null ? null : (sim.platforms.find((platform) => platform.id === p.ground) ?? null);
  let push = 0;
  if (ground?.kind === "cart") push = ground.dir * PLATFORM.cartPush;
  p.x = Math.min(FIELD.width - PLAYER.halfWidth, Math.max(PLAYER.halfWidth, p.x + (p.vx + push) * dt));

  // 垂直：站著跟著岩板走，走出邊緣就掉；空中受重力、落到岩板上
  if (ground && (ground.state === "falling" || !supports(ground, p.x))) {
    p.ground = null;
    ground = null;
  }
  if (ground) {
    p.y = ground.y;
    p.vy = 0;
    if (ground.kind === "rock") {
      if (p.hp < HEALTH.max) {
        p.regen += dt;
        if (p.regen >= HEALTH.regenSeconds) {
          p.regen = 0;
          p.hp++;
          sim.events.push({ type: "heal" });
        }
      } else p.regen = 0;
    } else p.regen = 0;
  } else {
    const prevY = p.y;
    p.vy = Math.min(PLAYER.maxFall, p.vy + PLAYER.gravity * dt);
    p.y += p.vy * dt;
    if (p.vy >= 0) {
      let hit: Platform | null = null;
      for (const platform of sim.platforms) {
        if (platform.state === "falling" || platform.id === p.squeezeSkip || !supports(platform, p.x)) continue;
        const before = platform.y + speed * dt;
        if (prevY <= before + 0.02 && p.y >= platform.y && (!hit || platform.y < hit.y)) hit = platform;
      }
      if (hit) land(sim, hit, p.vy);
    }
  }

  // 崩塌線：頭頂撞到扣血、被往下壓；靠近但沒撞到算驚險
  const ceiling = ceilingY(sim.scrolled);
  const headY = p.y - PLAYER.height;
  if (headY < ceiling && p.squeeze <= 0) {
    p.y = ceiling + PLAYER.height;
    p.squeezeSkip = p.ground;
    p.ground = null;
    p.vy = Math.max(p.vy, 2);
    p.squeeze = PLATFORM.squeezeSeconds;
    hurt(sim, "ceiling");
  } else if (headY - ceiling < PLAYER.height * SCORE.ceilingGrazeRatio && p.ceilCooldown <= 0 && p.squeeze <= 0 && p.ground !== null) {
    p.ceilCooldown = SCORE.ceilingGrazeCooldown;
    graze(sim, "ceiling", p.x, headY);
  }

  if (p.y > FIELD.height + 0.8) finish(sim, "fall");
}

/** 把累積的事件交給呼叫的地方（畫面、音效），並清空 */
export function drainEvents(sim: Sim): SimEvent[] {
  const events = sim.events;
  sim.events = [];
  return events;
}

/** 用同一個種子重新開始時，只有這個函式決定每局的種子（自由模式每局隨機）。 */
export function randomSeed(random: () => number = Math.random): number {
  return createRng(Math.floor(random() * 0xffffffff)).int(1, 0x7fffffff);
}
