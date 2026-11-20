// 依 prisma/schema.prisma 的變動產生下一個 D1 migration（migrations/NNNN_<名稱>.sql）。
//
//   npm run db:migration -- add_precise_stop_runs
//
// 做法：把現有的 migrations 依序套到一個暫存 SQLite 檔（prisma7.config.ts 的 datasource），
// 再和 schema 比對，差異就是新的 migration。沒有差異時不產生檔案。
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const name = process.argv[2];
if (!name || !/^[a-z0-9_]+$/.test(name)) {
  console.error("請給 migration 名稱（小寫英文、數字、底線），例如：npm run db:migration -- add_runs");
  process.exit(1);
}

const prisma = (...args) =>
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", ...args, "--config", "prisma7.config.ts"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });

const DB = ".wrangler/prisma-cli.db";
mkdirSync(".wrangler", { recursive: true });
rmSync(DB, { force: true });
writeFileSync(DB, "");

const files = readdirSync("migrations").filter((file) => /^\d{4}_.+\.sql$/.test(file)).sort();
for (const file of files) prisma("db", "execute", "--file", `migrations/${file}`);

const sql = prisma("migrate", "diff", "--from-config-datasource", "--to-schema", "prisma/schema.prisma", "--script");
rmSync(DB, { force: true });

if (!sql.includes("CREATE") && !sql.includes("ALTER") && !sql.includes("DROP")) {
  console.log("schema 和現有 migrations 一致，沒有產生新檔案。");
  process.exit(0);
}

const next = String(files.length + 1).padStart(4, "0");
const out = `migrations/${next}_${name}.sql`;
writeFileSync(out, sql);
console.log(`已產生 ${out}，內容：\n`);
console.log(readFileSync(out, "utf8"));
