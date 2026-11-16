// 把多張截圖並排成一張：wn sheet.cjs <輸出.png> <圖1.png> <圖2.png> ...
// 每張縮成 360 px 寬、一列最多 5 張，下方標檔名。用來一次比對多種語言或多個畫面。
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
(async () => {
  const [, , out, ...files] = process.argv;
  const figures = files
    .map((f) => `<figure><img src="data:image/png;base64,${fs.readFileSync(f).toString("base64")}"><figcaption>${path.basename(f)}</figcaption></figure>`)
    .join("");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 380 * Math.min(files.length, 5), height: 800 } });
  await page.setContent(
    `<style>body{margin:0;display:flex;flex-wrap:wrap;background:#333;font:12px sans-serif;color:#fff}figure{margin:4px;width:362px}img{width:360px;display:block}</style>${figures}`,
  );
  await page.screenshot({ path: out, fullPage: true });
  await browser.close();
})();
