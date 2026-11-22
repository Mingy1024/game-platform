import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

/**
 * 單元測試用的 D1：node:sqlite 的記憶體資料庫，套上 migrations/ 的全部 SQL（含觸發器）。
 * 只實作程式用到的部分：prepare().bind().all()/first()/run()、batch（包在一個交易裡，和 D1 一樣全部成功或全部失敗）。
 */
type Value = string | number | null;

export function sqliteD1() {
  const raw = new DatabaseSync(":memory:");
  raw.exec("PRAGMA foreign_keys = ON");
  for (const file of readdirSync("migrations").filter((name) => name.endsWith(".sql")).sort()) {
    raw.exec(readFileSync(`migrations/${file}`, "utf8"));
  }

  const isRead = (sql: string) => /^\s*(SELECT|WITH)\b/i.test(sql);
  class Statement {
    constructor(
      readonly sql: string,
      readonly params: Value[] = [],
    ) {}
    bind(...params: Value[]) {
      return new Statement(this.sql, params);
    }
    async all() {
      return this.exec();
    }
    async first<T>() {
      return (raw.prepare(this.sql).get(...this.params) ?? null) as T | null;
    }
    async run() {
      return this.exec();
    }
    exec() {
      const statement = raw.prepare(this.sql);
      if (isRead(this.sql)) return { results: statement.all(...this.params), success: true, meta: { changes: 0 } };
      const result = statement.run(...this.params);
      return { results: [], success: true, meta: { changes: Number(result.changes) } };
    }
  }

  const d1 = {
    prepare: (sql: string) => new Statement(sql),
    async batch(statements: Statement[]) {
      raw.exec("BEGIN");
      try {
        const results = statements.map((statement) => statement.exec());
        raw.exec("COMMIT");
        return results;
      } catch (error) {
        raw.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return { d1: d1 as unknown as D1Database, raw };
}

/** Prisma 在 D1 寫入 DateTime 的格式（固定 +00:00、毫秒三位） */
export const iso = (ms: number) => new Date(ms).toISOString().replace("Z", "+00:00");

export function addPlayer(raw: DatabaseSync, id: string, kind: "google" | "guest", { lastSeen = Date.now(), custom = null as string | null } = {}) {
  raw
    .prepare(
      "INSERT INTO players (id, kind, nick_adj, nick_noun, nick_num, nick_custom, created_at, last_seen_at) VALUES (?, ?, 1, 2, 3, ?, ?, ?)",
    )
    .run(id, kind, custom, iso(lastSeen), iso(lastSeen));
}

export function addBest(raw: DatabaseSync, playerId: string, mode: "daily" | "free", dateKey: string, score: number, at: number) {
  raw.prepare("INSERT INTO precise_stop_bests (player_id, mode, date_key, score, achieved_at) VALUES (?, ?, ?, ?, ?)").run(playerId, mode, dateKey, score, iso(at));
}
