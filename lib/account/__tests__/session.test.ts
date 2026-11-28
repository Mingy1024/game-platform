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

describe("GET 用的唯讀身分查詢（docs/plans/sync-hardening.md #4）", () => {
  it("peekSession／peekGuest 只查詢，不刪過期的、不續期、不更新最後使用時間", async () => {
    const { peekSession } = await import("../session");
    const { peekGuest } = await import("../guest");
    const now = new Date("2026-11-28T00:00:00Z");
    const writes: string[] = [];
    const sessions = new Map<string, { expiresAt: Date; playerId: string; player: { id: string; kind: string; lastSeenAt: Date } }>();
    const add = async (token: string, kind: string, expiresAt: Date) =>
      sessions.set(await sha256Hex(token), { expiresAt, playerId: `p-${token}`, player: { id: `p-${token}`, kind, lastSeenAt: new Date(0) } });
    await add("near", "google", new Date(now.getTime() + 24 * 3600 * 1000));
    await add("old", "google", new Date(now.getTime() - 1000));
    await add("guest", "guest", new Date(now.getTime() + SESSION_TTL_MS));
    const db = {
      session: {
        findUnique: async ({ where }: { where: { id: string } }) => sessions.get(where.id) ?? null,
        update: async () => writes.push("session.update"),
        delete: async () => writes.push("session.delete"),
        deleteMany: async () => writes.push("session.deleteMany"),
      },
      player: { update: async () => writes.push("player.update") },
    } as never;
    expect((await peekSession(db, "near", now))?.player.id).toBe("p-near");
    expect(await peekSession(db, "old", now)).toBeNull();
    expect(await peekSession(db, "missing", now)).toBeNull();
    expect((await peekGuest(db, "guest", now))?.player.id).toBe("p-guest");
    expect(await peekGuest(db, "near", now)).toBeNull();
    expect(writes).toEqual([]);
  });
});
