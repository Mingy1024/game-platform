import { describe, expect, it } from "vitest";
import {
  comboMultiplier,
  judge,
  overtimePenalty,
  overtimeSeconds,
  scoreRun,
  scoreStop,
  stopScore,
  totalScore,
} from "../scoring";

describe("C1 停車分", () => {
  it("各區間的端點", () => {
    expect(stopScore(0)).toBe(1000);
    expect(stopScore(0.05)).toBe(1000);
    expect(stopScore(0.050001)).toBe(990);
    expect(stopScore(0.3)).toBe(850);
    expect(stopScore(1)).toBe(500);
    expect(stopScore(2)).toBe(100);
    expect(stopScore(2.01)).toBe(0);
  });

  it("區間內線性遞減", () => {
    expect(stopScore(0.175)).toBe(920); // 5–30 cm 的中點
    expect(stopScore(0.65)).toBe(675); // 30 cm–1 m 的中點
    expect(stopScore(1.5)).toBe(300); // 1–2 m 的中點
  });

  it("停在標線前和過站，同樣的距離分數相同", () => {
    for (const error of [0.03, 0.2, 0.7, 1.4, 5]) {
      expect(stopScore(-error)).toBe(stopScore(error));
    }
  });
});

describe("C2 邊界值歸在較好的那一級", () => {
  it.each([
    [0.05, "perfect"],
    [0.3, "great"],
    [1, "good"],
    [2, "fair"],
    [-0.05, "perfect"],
    [-2, "fair"],
  ] as const)("%s m → %s", (error, expected) => {
    expect(judge(error)).toBe(expected);
  });

  it("剛超過邊界就降一級", () => {
    expect(judge(0.051)).toBe("great");
    expect(judge(0.301)).toBe("good");
    expect(judge(1.001)).toBe("fair");
    expect(judge(2.001)).toBe("miss");
  });
});

describe("C3 超時", () => {
  it("每秒扣 50 分，以 0.1 秒為單位", () => {
    expect(overtimePenalty(10, 10)).toBe(0);
    expect(overtimePenalty(10.09, 10)).toBe(0);
    expect(overtimePenalty(10.1, 10)).toBe(5);
    expect(overtimePenalty(11.2, 10)).toBe(60);
    expect(overtimeSeconds(11.27, 10)).toBe(1.2);
  });

  it("提早到不加分也不扣分", () => {
    expect(overtimePenalty(8, 10)).toBe(0);
    expect(scoreStop({ error: 0, elapsed: 5, target: 10 }, 0).score).toBe(1000);
  });

  it("扣到最低是 0", () => {
    expect(scoreStop({ error: 1.9, elapsed: 40, target: 10 }, 0).score).toBe(0);
  });
});

describe("C4 連擊", () => {
  it("倍率：×1.0、×1.1……最高 ×1.5", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 20].map(comboMultiplier)).toEqual([
      1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.5, 1.5,
    ]);
  });

  it("誤差 30 cm 內才算連擊，30 cm 整也算", () => {
    const results = scoreRun([
      { error: 0.3, elapsed: 0, target: 1 },
      { error: -0.3, elapsed: 0, target: 1 },
      { error: 0.31, elapsed: 0, target: 1 },
    ]);
    expect(results.map((result) => result.multiplier)).toEqual([1, 1.1, 1]);
    expect(results.map((result) => result.streak)).toEqual([1, 2, 0]);
  });

  it("中斷後下一站從 ×1.0 重新算", () => {
    const results = scoreRun([
      { error: 0.01, elapsed: 0, target: 1 },
      { error: 0.01, elapsed: 0, target: 1 },
      { error: 0.8, elapsed: 0, target: 1 },
      { error: 0.01, elapsed: 0, target: 1 },
      { error: 0.01, elapsed: 0, target: 1 },
    ]);
    expect(results.map((result) => result.multiplier)).toEqual([1, 1.1, 1, 1, 1.1]);
  });
});

describe("C5 單站得分", () => {
  it("（停車分 − 超時扣分）× 倍率，四捨五入", () => {
    const result = scoreStop({ error: 0.12, elapsed: 10.5, target: 10 }, 1);
    expect(result.stopScore).toBe(951);
    expect(result.penalty).toBe(25);
    expect(result.multiplier).toBe(1.1);
    expect(result.score).toBe(Math.round((951 - 25) * 1.1));
  });

  it("失誤得 0 分並中斷連擊", () => {
    const result = scoreStop({ error: 3.4, elapsed: 0, target: 10 }, 3);
    expect(result).toMatchObject({ judgement: "miss", score: 0, streak: 0, multiplier: 1 });
  });

  it("自動緊急停車一律算失誤", () => {
    const result = scoreStop({ error: 0.01, elapsed: 0, target: 10, emergency: true }, 2);
    expect(result).toMatchObject({ judgement: "miss", score: 0, streak: 0 });
  });
});

describe("C6 滿分", () => {
  it("五站全完美且不超時＝6,000 分", () => {
    const results = scoreRun(
      Array.from({ length: 5 }, () => ({ error: 0.02, elapsed: 9, target: 10 })),
    );
    expect(results.map((result) => result.score)).toEqual([1000, 1100, 1200, 1300, 1400]);
    expect(totalScore(results)).toBe(6000);
  });
});

describe("C7 設計稿的範例", () => {
  it("前 2 cm、過 12 cm、前 21 cm、過 64 cm 且超時 1.2 秒、過 4 cm → 4,746", () => {
    const results = scoreRun([
      { error: -0.02, elapsed: 8.7, target: 9 },
      { error: 0.12, elapsed: 9, target: 9.6 },
      { error: -0.21, elapsed: 11, target: 11.2 },
      { error: 0.64, elapsed: 13.2, target: 12 },
      { error: 0.04, elapsed: 14, target: 15 },
    ]);
    expect(results.map((result) => result.score)).toEqual([1000, 1046, 1080, 620, 1000]);
    expect(results.map((result) => result.judgement)).toEqual([
      "perfect",
      "great",
      "great",
      "good",
      "perfect",
    ]);
    expect(totalScore(results)).toBe(4746);
  });
});
