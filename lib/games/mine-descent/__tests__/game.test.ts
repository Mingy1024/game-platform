import { describe, expect, it } from "vitest";
import { autopilotAxis } from "../autopilot";
import { CEILING, FIELD, HEALTH, LAYER, MIX, PLATFORM, PLAYER, SCORE, SPEED_RAMP, STEP, ZONES } from "../config";
import { makeRow, zoneIndex, type PlatformSpec } from "../course";
import { MineSession } from "../session";
import { ceilingY, createSim, depthOf, scrollLayersPerSecond, step, totalScore, type Platform, type Sim } from "../sim";

/** 清空岩板，只放測試要的；玩家站在指定岩板上 */
function setup(kind: Platform["kind"] = "rock", x = 3, w = 3, y = 5): { sim: Sim; platform: Platform } {
  const sim = createSim(1);
  const platform: Platform = { id: 99, kind, x, y, w, dir: 1, state: "idle", timer: 0, spent: false, vy: 0 };
  sim.platforms = [platform];
  sim.lastRowY = 99; // 不再補新的一層
  sim.player.ground = 99;
  sim.player.x = x;
  sim.player.y = y;
  return { sim, platform };
}
const run = (sim: Sim, seconds: number, axis: -1 | 0 | 1 = 0) => {
  for (let i = 0; i < Math.round(seconds / STEP); i++) step(sim, axis);
};

describe("B1 左右移動", () => {
  it("0.1 秒加到最高速 4.5 m/s、放開後 0.08 秒停住", () => {
    const { sim } = setup();
    run(sim, 0.1, 1);
    expect(sim.player.vx).toBeCloseTo(PLAYER.maxSpeed, 1);
    run(sim, 0.09, 0);
    expect(sim.player.vx).toBe(0);
  });
  it("不會走出場地", () => {
    const { sim } = setup("rock", 3, 6);
    run(sim, 3, 1);
    expect(sim.player.x).toBeLessThanOrEqual(FIELD.width - PLAYER.halfWidth + 1e-9);
  });
});

describe("B2 重力與落地", () => {
  it("下落速度不超過 9 m/s", () => {
    const { sim } = setup();
    sim.platforms = [];
    sim.player.ground = null;
    sim.player.y = 1.5;
    run(sim, 0.5);
    expect(sim.player.vy).toBeLessThanOrEqual(PLAYER.maxFall + 1e-9);
    expect(sim.player.vy).toBeGreaterThan(8);
  });
  it("落到岩板上就站住並跟著上升", () => {
    const { sim, platform } = setup("rock", 3, 3, 5);
    sim.player.ground = null;
    sim.player.y = 3.5;
    run(sim, 1);
    expect(sim.player.ground).toBe(platform.id);
    expect(sim.player.y).toBeCloseTo(platform.y, 5);
  });
});

describe("B3 一般岩板回血", () => {
  it("扣到 4 格後站在一般岩板上每 1 秒回 1 格、最多 6 格", () => {
    const { sim } = setup("rock", 3, 3, 7.9);
    sim.player.hp = 4;
    run(sim, 1.02);
    expect(sim.player.hp).toBe(5);
    run(sim, 3);
    expect(sim.player.hp).toBe(HEALTH.max);
  });
  it("其他岩板上不回血", () => {
    const { sim } = setup("cart", 3, 3, 6);
    sim.player.hp = 4;
    run(sim, 2);
    expect(sim.player.hp).toBe(4);
  });
});

describe("B4 B12 尖刺與無敵", () => {
  it("踩到尖刺扣 1 格並小跳，同一塊尖刺只扎一次", () => {
    const { sim, platform } = setup("spike", 3, 3, 6);
    sim.player.ground = null;
    sim.player.y = 5;
    run(sim, 0.5);
    expect(sim.player.hp).toBe(HEALTH.max - 1);
    expect(platform.spent).toBe(true);
    run(sim, 2);
    expect(sim.player.hp).toBe(HEALTH.max - 1);
  });
  it("扣血後 0.8 秒內不會再扣", () => {
    const { sim } = setup("rock", 3, 3, 6);
    sim.player.hp = 3;
    sim.player.invuln = HEALTH.invulnSeconds;
    sim.player.y = 6;
    run(sim, 0.3);
    expect(sim.player.invuln).toBeGreaterThan(0.4);
  });
});

describe("B5 碎裂岩板", () => {
  it("站上去 0.4 秒後掉落，玩家跟著掉下去", () => {
    const { sim, platform } = setup("crack", 3, 3, 5);
    sim.player.ground = null;
    sim.player.y = 4.8;
    run(sim, 0.2);
    expect(sim.player.ground).toBe(platform.id);
    expect(platform.state).toBe("cracking");
    run(sim, PLATFORM.crackSeconds);
    expect(platform.state).toBe("falling");
    expect(sim.player.ground).toBeNull();
  });
});

describe("B6 礦軌推車", () => {
  it("站在上面會被往推車方向推走", () => {
    const { sim, platform } = setup("cart", 3, 3, 6);
    platform.dir = -1;
    const x0 = sim.player.x;
    run(sim, 1);
    expect(sim.player.x).toBeLessThan(x0 - 1.5);
  });
});

describe("B7 木支架彈跳", () => {
  it("彈起約 2 層高", () => {
    const { sim } = setup("wood", 3, 3, 6);
    sim.player.ground = null;
    sim.player.y = 5.8;
    let guard = 0;
    while (!sim.events.some((e) => e.type === "bounce") && guard++ < 2000) step(sim, 0);
    const top = sim.player.y;
    let peak = top;
    for (let i = 0; i < 400 && sim.player.vy <= 0; i++) {
      step(sim, 0);
      peak = Math.min(peak, sim.player.y);
    }
    expect(top - peak).toBeGreaterThan(PLATFORM.bounceLayers * LAYER * 0.9);
    expect(top - peak).toBeLessThan(PLATFORM.bounceLayers * LAYER * 1.15);
  });
});

describe("B8 C3 水晶", () => {
  it("第一次踩到加 30 分，同一顆只算一次", () => {
    const { sim, platform } = setup("crystal", 3, 3, 6);
    sim.player.ground = null;
    sim.player.y = 5.5;
    run(sim, 0.3);
    expect(sim.parts.crystal).toBe(SCORE.crystal);
    expect(platform.spent).toBe(true);
    sim.player.ground = null;
    sim.player.y = 5;
    run(sim, 0.5);
    expect(sim.parts.crystal).toBe(SCORE.crystal);
  });
});

describe("B9 崩塌線", () => {
  it("隨深度往下壓、有上限", () => {
    expect(ceilingY(0)).toBe(CEILING.base);
    expect(ceilingY(400)).toBeCloseTo(CEILING.base + 400 * CEILING.perMeter, 6);
    expect(ceilingY(1e6)).toBe(CEILING.base + CEILING.max);
  });
  it("頭頂撞到崩塌線扣 1 格、被往下壓穿過岩板", () => {
    const { sim } = setup("rock", 3, 3, 1.4);
    run(sim, 0.6);
    expect(sim.player.hp).toBe(HEALTH.max - 1);
    expect(sim.player.ground).toBeNull();
    expect(sim.hits).toBe(1);
  });
});

describe("B9b 被崩塌線壓到後，下面的岩板照常接住（Codex 審查第 8 項）", () => {
  it("只有頂著我的那一塊不能馬上再站；下面一層的岩板會接住，不會一路掉出畫面", () => {
    const { sim, platform } = setup("rock", 3, 6, 1.4);
    const lower: Platform = { id: 98, kind: "rock", x: 3, y: 3.2, w: 6, dir: 1, state: "idle", timer: 0, spent: false, vy: 0 };
    sim.platforms.push(lower);
    // 撞到之後 0.6 秒內要被下面一層接住（之後那一層又會把人頂向崩塌線，那是另一次撞擊，不在這個測試裡）
    let landed = false;
    for (let i = 0; i < Math.round(0.6 / STEP) && !landed; i++) {
      step(sim, 0);
      landed = sim.player.ground === lower.id;
    }
    expect(landed).toBe(true);
    expect(sim.over).toBeNull();
    expect(sim.player.hp).toBe(HEALTH.max - 1);
    expect(platform.y).toBeLessThan(sim.player.y);
  });
});

describe("D3b 主路岩板不含木支架（Codex 審查第 8 項）", () => {
  it("每層的主路岩板都是一般、礦軌推車、水晶其中一種", () => {
    let prev: PlatformSpec | null = null;
    for (let i = 1; i <= 2000; i++) {
      const row = makeRow(31, i, i * LAYER, prev);
      expect(["rock", "cart", "crystal"]).toContain(row.platforms[row.anchor].kind);
      prev = row.platforms[row.anchor];
    }
  });
});

describe("C8 倍率到期的那一步不再套用倍率（Codex 審查第 12 項）", () => {
  it("第 10 秒到期的那一步剛好跨過整數公尺：深度分用 ×1.0 算", () => {
    const { sim } = setup("rock", 3, 6, 7);
    sim.mult = 2;
    sim.grazeCount = 6;
    sim.multTimer = STEP / 2;
    sim.scrolled = 4 - 1e-4;
    sim.depthPaid = 3;
    step(sim, 0);
    expect(sim.mult).toBe(1);
    expect(sim.parts.depth).toBe(SCORE.perMeter);
  });
});

describe("B10 B11 體力歸零與掉出畫面", () => {
  it("體力歸零就結束（原因 hp）", () => {
    const { sim } = setup("spike", 3, 3, 6);
    sim.player.hp = 1;
    sim.player.ground = null;
    sim.player.y = 5.5;
    run(sim, 0.5);
    expect(sim.over).toBe("hp");
  });
  it("掉出畫面底部就結束（原因 fall）", () => {
    const { sim } = setup();
    sim.platforms = [];
    sim.player.ground = null;
    sim.player.y = 7;
    run(sim, 1);
    expect(sim.over).toBe("fall");
  });
});

describe("B13 可重現", () => {
  it("相同種子加相同操作得到相同結果", () => {
    const play = (seed: number) => {
      const sim = createSim(seed);
      for (let i = 0; i < 6000; i++) step(sim, ((Math.floor(i / 90) % 3) - 1) as -1 | 0 | 1);
      return JSON.stringify([sim.parts, sim.player, sim.platforms.length, sim.over]);
    };
    expect(play(42)).toBe(play(42));
    expect(play(42)).not.toBe(play(43));
  });
});

describe("B14 D4 D5 捲動速度", () => {
  it("五段速度 0.7～1.1 層／秒，700 m 後每 100 m 加 0.05、上限 1.5", () => {
    expect(ZONES.map((z) => scrollLayersPerSecond(z.from))).toEqual([0.7, 0.8, 0.9, 1.0, 1.1]);
    expect(scrollLayersPerSecond(800)).toBeCloseTo(1.15, 6);
    expect(scrollLayersPerSecond(5000)).toBe(SPEED_RAMP.max);
    expect([0, 99, 100, 249, 250, 449, 450, 699, 700].map(zoneIndex)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4]);
  });
});

describe("C1 深度分", () => {
  it("每下降 1 公尺加 10 分", () => {
    const { sim } = setup("rock", 3, 6, 6);
    sim.player.y = 6;
    run(sim, 2.5);
    expect(sim.parts.depth).toBe(depthOf(sim) * SCORE.perMeter);
    expect(depthOf(sim)).toBeGreaterThanOrEqual(2);
  });
});

describe("C2 邊緣落腳驚險", () => {
  it("落點在岩板邊緣 10% 以內加 50 分；落在中間不加", () => {
    const edge = setup("rock", 3, 2, 6);
    edge.sim.player.ground = null;
    edge.sim.player.x = 3 + 1 - 0.1;
    edge.sim.player.y = 5.6;
    run(edge.sim, 0.2);
    expect(edge.sim.parts.graze).toBe(SCORE.graze);
    const mid = setup("rock", 3, 2, 6);
    mid.sim.player.ground = null;
    mid.sim.player.y = 5.6;
    run(mid.sim, 0.2);
    expect(mid.sim.parts.graze).toBe(0);
  });
});

describe("C4 C5 C6 連段倍率", () => {
  const grazeNow = (sim: Sim) => {
    sim.player.ground = null;
    sim.player.x = 3 + 1 - 0.1;
    sim.player.y = 5.7;
    sim.player.vy = 0;
    run(sim, 0.2);
  };
  it("第一次驚險倍率 ×1、第二次起 ×1.2，每次 +0.2、最高 ×2.0", () => {
    const mults: number[] = [];
    const { sim, platform } = setup("rock", 3, 2, 6);
    for (let i = 0; i < 7; i++) {
      platform.y = 6;
      grazeNow(sim);
      mults.push(Math.round(sim.mult * 10) / 10);
    }
    expect(mults).toEqual([1, 1.2, 1.4, 1.6, 1.8, 2, 2]);
  });
  it("扣血就歸零；10 秒沒有驚險也歸零", () => {
    const { sim, platform } = setup("rock", 3, 2, 6);
    for (let i = 0; i < 3; i++) {
      platform.y = 6;
      grazeNow(sim);
    }
    expect(sim.mult).toBeGreaterThan(1);
    sim.player.hp = 5;
    sim.player.invuln = 0;
    sim.player.y = 0.5;
    sim.player.ground = null;
    step(sim, 0);
    expect(sim.mult).toBe(1);
    const other = setup("rock", 3, 6, 6);
    other.sim.mult = 1.4;
    other.sim.grazeCount = 3;
    other.sim.multTimer = SCORE.multSeconds;
    run(other.sim, SCORE.multSeconds + 0.1);
    expect(other.sim.mult).toBe(1);
  });
});

describe("C7 總分", () => {
  it("總分是深度分、驚險分、水晶分的和", () => {
    const sim = createSim(5);
    sim.parts = { depth: 120, graze: 100, crystal: 30 };
    expect(totalScore(sim)).toBe(250);
  });
});

describe("D1 D2 D3 每一層的岩板", () => {
  const specs = (seed: number, rows: number) => {
    const out: { row: { platforms: PlatformSpec[]; anchor: number }; prev: PlatformSpec | null }[] = [];
    let prev: PlatformSpec | null = { kind: "rock", x: 3, w: 3, dir: 1 };
    for (let i = 1; i <= rows; i++) {
      const row = makeRow(seed, i, i * LAYER, prev);
      out.push({ row, prev });
      prev = row.platforms[row.anchor];
    }
    return out;
  };
  it("D1 寬度在 1.2～2.4 m、都在場地內", () => {
    for (const { row } of specs(7, 400)) {
      for (const p of row.platforms) {
        expect(p.w).toBeGreaterThanOrEqual(1.2 - 1e-9);
        expect(p.w).toBeLessThanOrEqual(2.4 + 1e-9);
        expect(p.x - p.w / 2).toBeGreaterThanOrEqual(0);
        expect(p.x + p.w / 2).toBeLessThanOrEqual(FIELD.width);
      }
    }
  });
  it("D2 每層 1～3 塊、同層不重疊", () => {
    for (const { row } of specs(8, 400)) {
      expect(row.platforms.length).toBeGreaterThanOrEqual(1);
      expect(row.platforms.length).toBeLessThanOrEqual(3);
      const sorted = [...row.platforms].sort((a, b) => a.x - b.x);
      for (let i = 1; i < sorted.length; i++) expect(sorted[i].x - sorted[i].w / 2).toBeGreaterThan(sorted[i - 1].x + sorted[i - 1].w / 2);
    }
  });
  it("D3 每層至少一塊主路岩板（不是尖刺、碎裂），而且走得到上一層的主路", () => {
    for (const seed of [1, 2, 3, 99, 12345]) {
      for (const { row, prev } of specs(seed, 600)) {
        const anchor = row.platforms[row.anchor];
        expect(["rock", "cart", "wood", "crystal"]).toContain(anchor.kind);
        const gap = Math.max(0, Math.max(anchor.x - anchor.w / 2, prev!.x - prev!.w / 2) - Math.min(anchor.x + anchor.w / 2, prev!.x + prev!.w / 2));
        expect(gap).toBeLessThanOrEqual(0.6 + 1e-9);
      }
    }
  });
  it("D6 各段的種類比例（大量取樣）符合設定，未開放的種類不會出現", () => {
    const counts = [0, 1, 2, 3, 4].map(() => [0, 0, 0, 0, 0, 0]);
    const kinds = ["rock", "spike", "crack", "cart", "wood", "crystal"];
    for (let i = 1; i <= 6000; i++) {
      for (const zone of [0, 1, 2, 3, 4]) {
        const row = makeRow(77, i, ZONES[zone].from + 1, null);
        // 主路固定從主路種類抽，比例看「其餘岩板」
        for (const p of row.platforms.slice(1)) counts[zone][kinds.indexOf(p.kind)]++;
      }
    }
    expect(counts[0].slice(3)).toEqual([0, 0, 0]);
    expect(counts[1].slice(4)).toEqual([0, 0]);
    expect(counts[2].every((n) => n > 0)).toBe(true);
    for (const zone of [0, 1, 2, 3, 4]) {
      const total = counts[zone].reduce((a, b) => a + b, 0);
      const mix = MIX[zone];
      const mixTotal = mix.reduce((a, b) => a + b, 0);
      counts[zone].forEach((n, i) => expect(Math.abs(n / total - mix[i] / mixTotal)).toBeLessThan(0.03));
    }
  });
});

describe("D7 自由模式每局隨機", () => {
  it("每次重新開始種子不同", () => {
    const session = new MineSession();
    const seeds = new Set<number>();
    for (let i = 0; i < 20; i++) {
      session.restart();
      seeds.add(session.sim.seed);
    }
    expect(seeds.size).toBeGreaterThan(15);
  });
});

describe("F 流程與自動駕駛", () => {
  it("F1 準備 → 進行 → 暫停 → 繼續；暫停時模擬不前進", () => {
    const s = new MineSession(() => 1);
    expect(s.phase).toBe("ready");
    s.update(100);
    expect(s.sim.time).toBe(0);
    s.start();
    s.update(100);
    expect(s.sim.time).toBeGreaterThan(0.09);
    s.pause();
    const t = s.sim.time;
    s.update(500);
    expect(s.phase).toBe("paused");
    expect(s.sim.time).toBe(t);
    s.resume();
    expect(s.phase).toBe("playing");
  });
  it("F2 失敗後先進入失敗動畫、再結算；結算有深度、總分、原因", () => {
    const s = new MineSession(() => 3);
    s.start();
    s.sim.player.hp = 1;
    s.sim.player.ground = null;
    s.sim.player.y = 0.2;
    s.update(100);
    expect(s.phase).toBe("dying");
    for (let i = 0; i < 20; i++) s.update(100);
    expect(s.phase).toBe("over");
    expect(s.result).toMatchObject({ reason: "hp" });
    expect(s.result!.total).toBe(s.result!.parts.depth + s.result!.parts.graze + s.result!.parts.crystal);
  });
  it("F3 自動駕駛多半能撐過 1 分鐘（驗證每層都有路、沒有死胡同到玩不下去）", () => {
    const times: number[] = [];
    for (let i = 1; i <= 12; i++) {
      const sim = createSim(i * 7919);
      while (!sim.over && sim.time < 150) step(sim, autopilotAxis(sim));
      times.push(sim.time);
    }
    times.sort((a, b) => a - b);
    expect(times[6]).toBeGreaterThan(60);
    expect(times[11]).toBeGreaterThan(120);
  });
  it("F4 autopilotAxis 回傳 -1、0、1", () => {
    expect([-1, 0, 1]).toContain(autopilotAxis(createSim(1)));
  });
});
