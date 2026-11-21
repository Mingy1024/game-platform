// Cloudflare Workers 的入口：包住 Nitro 原本的 cloudflare_module 入口，
// 在 Nitro 把請求內容整個讀進記憶體之前，先擋掉太大的請求（見 server/body-limit.ts）。
// 只在正式建置（cloudflare_module）時使用，設定在 nuxt.config.ts 的 nitro.modules；開發、預先產生頁面時不經過這裡。
// 排程（scheduled）等其他事件原封不動交給 Nitro。
import nitroEntry from "#nitro-cloudflare-module";
import { limitRequestBody } from "./body-limit";

type Handler = {
  fetch(request: Request, env: unknown, context: unknown): Promise<Response>;
  [event: string]: unknown;
};
const original = nitroEntry as Handler;

export default {
  ...original,
  async fetch(request: Request, env: unknown, context: unknown) {
    const checked = await limitRequestBody(request);
    if (checked instanceof Response) return checked;
    return original.fetch(checked, env, context);
  },
};
