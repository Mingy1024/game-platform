// 截圖：wn shot.cjs <網址路徑> <輸出.png> [寬] [高] [步驟...]
// 步驟：click=<selector>  wait=<毫秒>  waitfor=<selector>  key=<按鍵>  down=<按鍵>  up=<按鍵>
//       eval=<JS 運算式（印出結果）>  shot=<中途截圖路徑>  full（最後整頁截圖）
// 寬度小於 600 時模擬手機觸控。會印出 HTTP 狀態與主控台的錯誤、警告。
const { chromium } = require("@playwright/test");
(async () => {
  const [, , path, out, w = "1280", h = "900", ...steps] = process.argv;
  const width = +w;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height: +h }, isMobile: width < 600, hasTouch: width < 600 });
  const logs = [];
  page.on("console", (m) => {
    if (["error", "warning"].includes(m.type()) && !m.text().includes("GL Driver")) logs.push(`${m.type()}: ${m.text().slice(0, 300)}`);
  });
  page.on("pageerror", (e) => logs.push(`pageerror: ${String(e).slice(0, 400)}`));
  const base = process.env.BASE_URL || "http://localhost:3000";
  const res = await page.goto(base + path, { waitUntil: "networkidle" });
  console.log("status", res && res.status());
  for (const step of steps) {
    const [cmd, ...rest] = step.split("=");
    const arg = rest.join("=");
    if (cmd === "click") await page.click(arg);
    else if (cmd === "wait") await page.waitForTimeout(+arg);
    else if (cmd === "waitfor") await page.waitForSelector(arg, { timeout: 60000 });
    else if (cmd === "key") await page.keyboard.press(arg);
    else if (cmd === "down") await page.keyboard.down(arg);
    else if (cmd === "up") await page.keyboard.up(arg);
    else if (cmd === "eval") console.log("eval:", JSON.stringify(await page.evaluate(arg)));
    else if (cmd === "shot") await page.screenshot({ path: arg });
  }
  await page.screenshot({ path: out, fullPage: steps.includes("full") });
  if (logs.length) console.log(logs.slice(0, 15).join("\n"));
  await browser.close();
})().catch((e) => { console.error(String(e).slice(0, 800)); process.exit(1); });
