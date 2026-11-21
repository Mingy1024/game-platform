import { describe, expect, it } from "vitest";
import { randomId, randomInt, randomToken, sha256Hex } from "../crypto";
import { renewedExpiry, SESSION_TTL_MS } from "../session";

const DAY = 24 * 60 * 60 * 1000;

describe("session 延長", () => {
  const now = new Date("2026-11-20T00:00:00Z");

  it("剩 200 天以上不延長", () => {
    expect(renewedExpiry(new Date(now.getTime() + 300 * DAY), now)).toBeNull();
    expect(renewedExpiry(new Date(now.getTime() + 200 * DAY), now)).toBeNull();
  });

  it("剩不到 200 天就延長回 400 天", () => {
    expect(renewedExpiry(new Date(now.getTime() + 199 * DAY), now)?.getTime()).toBe(now.getTime() + SESSION_TTL_MS);
  });
});

describe("隨機值與雜湊", () => {
  it("ID 是 21 個網址安全字元，token 是 43 個字元", () => {
    expect(randomId()).toMatch(/^[0-9A-Za-z_-]{21}$/);
    expect(randomToken()).toMatch(/^[0-9A-Za-z_-]{43}$/);
    expect(randomToken()).not.toBe(randomToken());
  });

  it("randomInt 在範圍內", () => {
    for (let i = 0; i < 200; i++) {
      const value = randomInt(32);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(32);
    }
  });

  it("SHA-256 hex", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
