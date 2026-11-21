import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { defineEventHandler, serveStatic } from "h3";
import { defineNuxtModule } from "nuxt/kit";

/**
 * 只在 nuxt dev 時作用：public/ 的靜態檔案改成「遇到資料夾不轉址」。
 *
 * public/games/precise-stop/ 是遊戲素材的資料夾，和頁面 /games/precise-stop 同名；
 * 開發伺服器預設會把 /games/precise-stop 轉到 /games/precise-stop/（301），頁面就打不開了。
 * 這裡只提供真的存在的檔案，其他請求交給頁面。
 * 正式站（Cloudflare Workers）由 wrangler.jsonc 的 html_handling 處理，不受影響。
 */
const TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/vnd.microsoft.icon",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".json": "application/json",
};

export default defineNuxtModule({
  meta: { name: "dev-public-dir" },
  setup(_options, nuxt) {
    if (!nuxt.options.dev) return;
    const dir = resolve(nuxt.options.rootDir, "public");
    const fileOf = (id: string) => {
      const file = resolve(dir, `.${decodeURIComponent(id.split("?")[0] ?? "")}`);
      return file.startsWith(dir + sep) ? file : null;
    };

    nuxt.hook("nitro:config", (config) => {
      config.publicAssets = (config.publicAssets ?? []).filter((asset) => !asset?.dir || resolve(asset.dir) !== dir);
      config.devHandlers = [
        ...(config.devHandlers ?? []),
        {
          route: "/",
          // serveStatic 找不到檔案時回傳 false；這裡改回傳 undefined，請求才會交給後面的頁面處理
          handler: defineEventHandler(async (event) => {
            const served = await serveStatic(event, {
              fallthrough: true,
              indexNames: [],
              async getMeta(id) {
                const file = fileOf(id);
                const info = file ? await stat(file).catch(() => null) : null;
                if (!file || !info?.isFile()) return undefined;
                return { size: info.size, mtime: info.mtimeMs, type: TYPES[extname(file).toLowerCase()] };
              },
              getContents(id) {
                const file = fileOf(id);
                return file ? readFile(file) : undefined;
              },
            });
            return served === false ? undefined : served;
          }),
        },
      ];
    });
  },
});
