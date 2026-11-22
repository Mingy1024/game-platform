import { describe, expect, it } from "vitest";
import { applyAction, autopilotAction, playAutopilot } from "../autopilot";
import { CLOCK, MOVE, SEGMENTS, SEGMENT_COUNT, STEP, TICKS_PER_SECOND } from "../config";
import { JUMPABLE, LAYOUT, rollRun, segmentSpeed, openDoorLane, gazeLane } from "../route";
import { clockText, endingFor, eventPoints, grazeMultiplier, grazePoints, multiplierFor, secondsShort, timeScore, totalScore } from "../scoring";
import { GameSession } from "../session";
import { Sim } from "../sim";

const sec = (n: number) => Math.round(n * TICKS_PER_SECOND);
/** 把玩家放在某個障礙前面一點點，方便測試單一碰撞 */
function placeBefore(sim: Sim, z: number, lane: -1 | 0 | 1) {
  sim.z = z - 0.01;
  sim.lane = lane;
  sim.x = lane;
  sim.segment = LAYOUT.segments.findIndex((s) => z >= s.start && z < s.start + s.length);
}
const firstOf = (kind: string) => LAYOUT.obstacles.find((o) => o.kind === kind)!;

describe("B1 前進速度", () => {
  it("第 1 段 6 m/s，每段加快 10%", () => {
    expect([0, 1, 2, 3].map(segmentSpeed).map((v) => Math.round(v * 1000) / 1000)).toEqual([6, 6.6, 7.26, 7.986]);
  });
  it("咖啡加速 ×1.4，3 秒後恢復", () => {
    const sim = new Sim(rollRun(1));
    sim.coffeeLeft = sec(MOVE.coffeeSeconds);
    expect(sim.speed).toBeCloseTo(8.4);
    for (let i = 0; i < sec(3); i++) sim.step();
    expect(sim.coffeeLeft).toBe(0);
    expect(sim.speed).toBeCloseTo(6);
  });
});

describe("B2 B3 換線與跳躍", () => {
  it("換線歷時 0.15 秒（18 步），之後剛好在新的線上", () => {
    const sim = new Sim(rollRun(1));
    sim.moveLane(1);
    for (let i = 0; i < 17; i++) sim.step();
    expect(sim.x).toBeGreaterThan(0.9);
    expect(sim.x).toBeLessThan(1);
    sim.step();
    expect(sim.x).toBe(1);
  });
  it("跳躍滯空 0.5 秒；跳躍中不能換線，落地才能再跳", () => {
    const sim = new Sim(rollRun(1));
    sim.jump();
    sim.moveLane(1);
    expect(sim.lane).toBe(0);
    let steps = 1;
    while (sim.jumpTick > 0) {
      sim.step();
      steps++;
    }
    expect(steps).toBe(sec(MOVE.jumpSeconds) + 1);
    sim.moveLane(1);
    expect(sim.lane).toBe(1);
  });
  it("邊界：左邊再往左不會離開三條線", () => {
    const sim = new Sim(rollRun(1));
    sim.moveLane(-1);
    for (let i = 0; i < 20; i++) sim.step();
    sim.moveLane(-1);
    expect(sim.lane).toBe(-1);
  });
});

describe("B4 固定步進、可重現", () => {
  it("同一個種子同樣的自動駕駛，結果完全相同", () => {
    const a = playAutopilot(new Sim(rollRun(123)));
    const b = playAutopilot(new Sim(rollRun(123)));
    expect(a).toEqual(b);
  });
  it("畫面更新率不同（30／60／144 fps），結果也相同", () => {
    const results = [30, 60, 144].map((fps) => {
      const session = new GameSession(77);
      session.autopilot = true;
      session.depart();
      for (let i = 0; i < 20000 && session.getSnapshot().phase !== "final"; i++) {
        if (session.getSnapshot().phase === "briefing") session.depart();
        session.update(1 / fps);
      }
      return session.getSnapshot().result;
    });
    expect(results[0]).toBeTruthy();
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
  });
});

describe("B5 B6 B8 撞到東西", () => {
  it("B5 撞到搭話同事：停 1.5 秒（180 步）、連段歸零；時鐘照走", () => {
    const o = firstOf("chatter");
    const sim = new Sim(rollRun(1));
    placeBefore(sim, o.z, o.lane);
    sim.grazeStreak = 3;
    sim.step();
    expect(sim.stun).toMatchObject({ kind: "held", left: sec(1.5) });
    expect(sim.grazeStreak).toBe(0);
    expect(sim.heldByColleague).toBe(true);
    const before = sim.tick;
    for (let i = 0; i < sec(1.5); i++) sim.step();
    expect(sim.stun).toBeNull();
    expect(sim.tick - before).toBe(sec(1.5));
  });
  it("B6 撞到清潔推車：跌倒 1 秒", () => {
    const o = LAYOUT.obstacles.find((x) => x.kind === "cart")!;
    const sim = new Sim(rollRun(1));
    placeBefore(sim, o.z, o.lane);
    sim.step();
    expect(sim.stun).toMatchObject({ kind: "trip", left: sec(1) });
  });
  it("B8 紙箱可以跳過，同事和推車不行", () => {
    const box = firstOf("box");
    const sim = new Sim(rollRun(1));
    placeBefore(sim, box.z, box.lane);
    sim.jumpTick = sec(0.25);
    sim.step();
    expect(sim.stun).toBeNull();
    expect(JUMPABLE.has("box") && JUMPABLE.has("chair")).toBe(true);
    expect(["chatter", "copier", "cart", "commuter"].some((k) => JUMPABLE.has(k as never))).toBe(false);
    const cart = LAYOUT.obstacles.find((x) => x.kind === "cart")!;
    const sim2 = new Sim(rollRun(1));
    placeBefore(sim2, cart.z, cart.lane);
    sim2.jumpTick = sec(0.25);
    sim2.step();
    expect(sim2.stun?.kind).toBe("trip");
  });
  it("耳機：3 秒內同事不搭話", () => {
    const o = firstOf("chatter");
    const sim = new Sim(rollRun(1));
    placeBefore(sim, o.z, o.lane);
    sim.headphonesLeft = sec(3);
    sim.step();
    expect(sim.stun).toBeNull();
  });
});

describe("B7 電梯門", () => {
  const door = LAYOUT.doors[0];
  it("沒擠進開著的門：等 4 秒", () => {
    const sim = new Sim(rollRun(1));
    placeBefore(sim, door.z, 0);
    const open = openDoorLane(door, (sim.tick + 1) / TICKS_PER_SECOND);
    const lane = ([-1, 0, 1] as const).find((l) => l !== open)!;
    placeBefore(sim, door.z, lane);
    sim.step();
    expect(sim.stun).toMatchObject({ kind: "door", left: sec(4) });
  });
  it("擠進開著的那條線：不損失", () => {
    const sim = new Sim(rollRun(1));
    placeBefore(sim, door.z, 0);
    const open = openDoorLane(door, (sim.tick + 1) / TICKS_PER_SECOND);
    placeBefore(sim, door.z, open);
    sim.step();
    expect(sim.stun).toBeNull();
    expect(sim.drain().some((e) => e.type === "door" && e.passed)).toBe(true);
  });
});

describe("B9 B11 B12 主管視線與突發事件", () => {
  const zone = LAYOUT.gazes[0];
  function intoGaze() {
    const sim = new Sim(rollRun(5));
    sim.segment = 1;
    sim.z = zone.z + 0.5;
    sim.tick = sec(10);
    const lane = gazeLane(zone, sim.clockSeconds);
    sim.lane = lane;
    sim.x = lane;
    return { sim, lane };
  }
  it("B9 視線掃到玩家：該段第一次是突發事件，同一段之後改成停 1 秒", () => {
    const { sim } = intoGaze();
    sim.step();
    expect(sim.event?.pool).toBe("boss");
    expect(sim.calledByBoss).toBe(true);
    sim.answer(0);
    const second = LAYOUT.gazes[1];
    sim.z = second.z + 0.5;
    const lane = gazeLane(second, sim.clockSeconds);
    sim.lane = lane;
    sim.x = lane;
    sim.step();
    expect(sim.stun).toMatchObject({ kind: "gaze", left: sec(1) });
  });
  it("勿擾模式擋掉下一次突發事件，不算被叫住", () => {
    const { sim } = intoGaze();
    sim.dnd = true;
    sim.step();
    expect(sim.event).toBeNull();
    expect(sim.dnd).toBe(false);
    expect(sim.calledByBoss).toBe(false);
  });
  it("B12 選錯得 0 分且時鐘再往前跳 5 秒；選最佳 +300、普通 +100（C4）", () => {
    const grades = [0, 1, 2].map((grade) => {
      const { sim } = intoGaze();
      sim.step();
      const pos = sim.event!.dialogue.order.indexOf(grade);
      const before = sim.tick;
      sim.answer(pos);
      return { event: sim.parts.event, jump: sim.tick - before };
    });
    expect(grades).toEqual([{ event: 300, jump: 0 }, { event: 100, jump: 0 }, { event: 0, jump: sec(5) }]);
    expect([0, 1, 2].map(eventPoints)).toEqual([300, 100, 0]);
  });
  it("B11 事件出現時世界放慢到 20%，3 秒內沒回答算選錯", () => {
    const session = new GameSession(5);
    session.depart();
    session.sim.segment = 1;
    session.sim.z = zone.z + 0.5;
    session.sim.tick = sec(10);
    const lane = gazeLane(zone, session.sim.clockSeconds);
    session.sim.lane = lane;
    session.sim.x = lane;
    session.update(STEP * 2);
    expect(session.getSnapshot().event).not.toBeNull();
    const z0 = session.sim.z;
    for (let i = 0; i < 4; i++) session.update(0.25);
    // 放慢到 20%：真實 1 秒只前進約 0.2 秒的距離
    expect(session.sim.z - z0).toBeCloseTo(0.2 * session.sim.speed, 0);
    expect(session.getSnapshot().event).not.toBeNull();
    for (let i = 0; i < 8; i++) session.update(0.25);
    expect(session.getSnapshot().event).toBeNull();
    expect(session.sim.parts.event).toBe(0);
  });
});

describe("B10 時鐘與結局", () => {
  it("時鐘 18:00:00 起算；走過 18:01:30 還沒出門就被攔下", () => {
    const sim = new Sim(rollRun(1));
    expect(clockText(0)).toBe("18:00:00");
    sim.tick = CLOCK.callAt * TICKS_PER_SECOND;
    sim.step();
    expect(sim.caught).toBe(true);
    expect(sim.result?.ending).toBe("overtime");
    expect(clockText(90 * TICKS_PER_SECOND)).toBe("18:01:30");
  });
});

describe("B14 B15 路線", () => {
  it("B14 每一排至少留一條沒有擋路的線；第 1 段約每 2 秒一排、第 4 段約每 1.2 秒一排", () => {
    const rows = new Map<number, number[]>();
    for (const o of LAYOUT.obstacles) rows.set(o.z, [...(rows.get(o.z) ?? []), o.lane]);
    for (const [, lanes] of rows) expect(new Set(lanes).size).toBeLessThanOrEqual(2);
    const gap = (segment: number) => {
      const zs = [...new Set(LAYOUT.obstacles.filter((o) => o.segment === segment).map((o) => o.z))].sort((a, b) => a - b);
      const diffs = zs.slice(1).map((z, i) => z - zs[i]).filter((d) => d < 30);
      return Math.min(...diffs) / LAYOUT.segments[segment].speed;
    };
    expect(gap(0)).toBeGreaterThanOrEqual(1.9);
    expect(gap(3)).toBeLessThanOrEqual(1.45);
    expect(gap(3)).toBeGreaterThanOrEqual(1.15);
  });
  it("B15 自動駕駛不被耽誤也能跑完：60 秒內出門（秒速下班）", () => {
    for (const seed of [1, 2, 3, 99, 2026]) {
      const sim = new Sim(rollRun(seed));
      const result = playAutopilot(sim);
      expect(result?.ending, `seed ${seed}`).toBe("fast");
      expect(sim.stun).toBeNull();
      expect(sim.heldByColleague).toBe(false);
    }
  });
  it("B17 穿過旋轉門前還沒下班", () => {
    const sim = new Sim(rollRun(1));
    sim.z = LAYOUT.total - 1;
    sim.segment = SEGMENT_COUNT - 1;
    expect(sim.finished).toBe(false);
    sim.step();
    for (let i = 0; i < 300; i++) sim.step();
    expect(sim.finished).toBe(true);
  });
});

describe("C1 時間分", () => {
  it("比目標早到每 0.1 秒加 10 分；不足 0.1 秒捨去；晚到得 0", () => {
    expect(timeScore(20, sec(14))).toBe(600);
    expect(timeScore(20, sec(14) + 1)).toBe(590);
    expect(timeScore(20, sec(20))).toBe(0);
    expect(timeScore(20, sec(25))).toBe(0);
    expect(timeScore(15, sec(15) - 12)).toBe(10);
    expect(timeScore(15, sec(15) - 11)).toBe(0);
  });
});

describe("C2 C3 擦身閃避", () => {
  it("連段倍率：第 1 次 ×1.0、第 2 次 ×1.1，最高 ×1.5", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 20].map(grazeMultiplier)).toEqual([1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.5, 1.5]);
    expect([1, 2, 6].map(grazePoints)).toEqual([50, 55, 75]);
  });
  it("橫向距離小於 0.3 個線寬（碰撞邊緣外）才算擦身，剛好 0.3 不算；撞到會歸零連段", () => {
    const o = firstOf("chatter");
    const at = (dx: number) => {
      const sim = new Sim(rollRun(1));
      placeBefore(sim, o.z, o.lane);
      sim.x = o.lane - dx;
      sim.grazeStreak = 2;
      sim.step();
      return sim;
    };
    // 碰撞邊緣是 0.6（玩家半寬 0.2＋障礙半寬 0.4）
    expect(at(0.59).stun?.kind).toBe("held");
    expect(at(0.59).grazeStreak).toBe(0);
    expect(at(0.6).grazes).toBe(1);
    expect(at(0.89).grazes).toBe(1);
    expect(at(0.9).grazes).toBe(0);
    expect(at(1).grazes).toBe(0);
    expect(at(0.6).parts.graze).toBe(60);
  });
});

describe("C5 C6 C7 C8 道具、倍率、總分", () => {
  it("撿到一個道具 +20", () => {
    const item = rollRun(1).items[0];
    const sim = new Sim(rollRun(1));
    sim.segment = item.segment;
    sim.z = item.z - 0.01;
    sim.lane = item.lane;
    sim.x = item.lane;
    sim.step();
    expect(sim.parts.item).toBe(20);
  });
  it("C6 倍率邊界：剛好 60.0 秒 ×2.0、剛好 90.0 秒 ×1.5、超過 ×1.0", () => {
    expect(endingFor(sec(60))).toBe("fast");
    expect(endingFor(sec(60) + 1)).toBe("ontime");
    expect(endingFor(sec(90))).toBe("ontime");
    expect(endingFor(sec(90) + 1)).toBe("overtime");
    expect(["fast", "ontime", "overtime"].map((e) => multiplierFor(e as never))).toEqual([2, 1.5, 1]);
  });
  it("C7 總分＝（時間＋閃避＋事件＋道具）× 倍率，四捨五入", () => {
    expect(totalScore({ time: 2000, graze: 105, event: 400, item: 40 }, "fast")).toBe(5090);
    expect(totalScore({ time: 1, graze: 0, event: 0, item: 0 }, "ontime")).toBe(2);
    expect(totalScore({ time: 3, graze: 0, event: 0, item: 0 }, "ontime")).toBe(5);
  });
  it("C8 差 N 秒就衝出大門：進位到 0.1 秒", () => {
    expect(secondsShort(10, 6)).toBe(1.7);
    expect(secondsShort(6, 6)).toBe(1);
  });
  it("C10 手算範例：自動駕駛種子 1 的總分等於各項加總乘倍率", () => {
    const result = playAutopilot(new Sim(rollRun(1)))!;
    const sum = result.parts.time + result.parts.graze + result.parts.event + result.parts.item;
    expect(result.total).toBe(Math.round(sum * 2));
    expect(result.segmentTicks).toHaveLength(SEGMENT_COUNT);
  });
});

describe("C9 隱藏結局", () => {
  it("沒被叫住也沒被拉住就出門才算；被拉住或被叫住不算", () => {
    const sim = new Sim(rollRun(1));
    sim.z = LAYOUT.total - 0.001;
    sim.segment = 3;
    sim.step();
    expect(sim.result?.hidden).toBe(true);
    const held = new Sim(rollRun(1));
    held.heldByColleague = true;
    held.z = LAYOUT.total - 0.001;
    held.segment = 3;
    held.step();
    expect(held.result?.hidden).toBe(false);
    const called = new Sim(rollRun(1));
    called.calledByBoss = true;
    called.z = LAYOUT.total - 0.001;
    called.segment = 3;
    called.step();
    expect(called.result?.hidden).toBe(false);
  });
});

describe("D 路線與隨機", () => {
  it("D1 固定 4 段，段名依序", () => {
    expect(SEGMENTS.map((s) => s.id)).toEqual(["office", "corridor", "elevator", "lobby"]);
    expect(LAYOUT.segments).toHaveLength(4);
    expect(SEGMENTS.map((s) => s.target)).toEqual([20, 25, 20, 15]);
  });
  it("D2 障礙與事件位置固定；D3 只有台詞與道具所在的線隨機", () => {
    const a = rollRun(1);
    const b = rollRun(2);
    expect(a.items.map((i) => [i.z, i.kind])).toEqual(b.items.map((i) => [i.z, i.kind]));
    expect(a.items.map((i) => i.lane).join() !== b.items.map((i) => i.lane).join() || JSON.stringify(a.dialogues) !== JSON.stringify(b.dialogues)).toBe(true);
    expect(a.items.filter((i) => i.segment === 0)).toHaveLength(2);
    expect(a.items.filter((i) => i.segment === 3)).toHaveLength(1);
  });
  it("D4 同一個種子重現同一局的台詞與道具", () => {
    expect(rollRun(424242)).toEqual(rollRun(424242));
  });
  it("D5 三個台詞庫各抽一句，每個庫 20 句", () => {
    for (let seed = 0; seed < 200; seed++) {
      const run = rollRun(seed);
      for (const pool of ["coworker", "boss", "group"] as const) {
        expect(run.dialogues[pool].line).toBeGreaterThanOrEqual(0);
        expect(run.dialogues[pool].line).toBeLessThan(20);
        expect([...run.dialogues[pool].order].sort()).toEqual([0, 1, 2]);
      }
    }
  });
  it("自動駕駛會在突發事件選最佳", () => {
    const sim = new Sim(rollRun(8));
    const result = playAutopilot(sim);
    expect(result?.parts.event).toBeGreaterThanOrEqual(0);
    expect(applyAction).toBeTypeOf("function");
    expect(autopilotAction(sim)).toEqual({});
  });
});

describe("B16 D7 第 4 段與讀卡機", () => {
  it("B16 讀卡機只有事件（嗶一聲），不是障礙、不擋路、不耽誤", () => {
    const sim = new Sim(rollRun(1));
    sim.segment = 3;
    sim.z = LAYOUT.readerZ - 0.01;
    sim.lane = 0;
    sim.x = 0;
    sim.step();
    expect(sim.drain().some((event) => event.type === "reader")).toBe(true);
    expect(sim.stun).toBeNull();
    expect(LAYOUT.obstacles.some((o) => o.z === LAYOUT.readerZ)).toBe(false);
  });
  it("D7 第 4 段沒有突發事件選擇題、沒有主管視線；穿過旋轉門才下班", () => {
    expect(LAYOUT.events.some((e) => e.segment === 3)).toBe(false);
    expect(LAYOUT.gazes.some((g) => g.segment === 3)).toBe(false);
    expect(LAYOUT.doors.every((d) => d.segment === 2)).toBe(true);
    expect(LAYOUT.gazes.every((g) => g.segment === 1)).toBe(true);
  });
  it("E4 繼續遊戲後有緩衝：暫停繼續的第一秒世界不前進", () => {
    const session = new GameSession(3);
    session.depart();
    session.update(0.5);
    const z = session.sim.z;
    session.pause();
    session.resume();
    // 每次更新最多補 0.25 秒；緩衝 1 秒 = 前 4 次更新都不前進
    for (let i = 0; i < 4; i++) session.update(0.25);
    expect(session.sim.z).toBe(z);
    session.update(0.25);
    session.update(0.25);
    expect(session.sim.z).toBeGreaterThan(z);
  });
  it("G6 減少動態效果：突發事件不放慢（限時仍然照算）", () => {
    const run = (reduce: boolean) => {
      const session = new GameSession(5);
      session.reduceMotion = reduce;
      session.depart();
      session.sim.segment = 0;
      session.sim.z = 46 - 0.5;
      session.update(0.1);
      expect(session.getSnapshot().event).not.toBeNull();
      const z = session.sim.z;
      session.update(0.25);
      return session.sim.z - z;
    };
    expect(run(true)).toBeGreaterThan(run(false) * 3);
  });
});
