// 修正 @opennextjs/aws 4.2.0 的 cookie 匯入（npm install 後自動執行，見 package.json 的 postinstall）。
//
// 它寫的是 `import cookieParser from "cookie"`，但 cookie 1.x 只有具名匯出（parse 等）。
// OpenNext 打包 middleware 時沒用 Node 的相容模式，cookieParser 會變成 undefined，
// 結果在 Cloudflare Workers 上，只要請求帶 cookie（例如已登入）就整個 500。
// 改成 `import * as cookieParser from "cookie"`，兩種模式都拿得到 cookieParser.parse。
//
// OpenNext 修好之後（上面那行不見了），這支腳本什麼都不做，可以刪掉。
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const files = ["node.js", "edge.js"].map((name) => `node_modules/@opennextjs/aws/dist/overrides/converters/${name}`);
const before = 'import cookieParser from "cookie";';
const after = 'import * as cookieParser from "cookie";';

for (const file of files) {
  if (!existsSync(file)) continue;
  const source = readFileSync(file, "utf8");
  if (source.includes(after)) continue;
  if (!source.includes(before)) {
    console.warn(`[patch-opennext] ${file} 的內容變了，沒有修改；請確認 OpenNext 是否已修好 cookie 匯入`);
    continue;
  }
  writeFileSync(file, source.replace(before, after));
  console.log(`[patch-opennext] 已修正 ${file}`);
}
