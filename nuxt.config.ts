import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { prerenderRoutes } from "./lib/routes";

const root = fileURLToPath(new URL("./", import.meta.url));
const nitroDir = dirname(createRequire(import.meta.url).resolve("nitropack/package.json"));

/**
 * 建置時就決定的值（和以前的 NEXT_PUBLIC_* 一樣，寫死進前端與伺服器的程式）。
 * 預先產生的頁面也依這些值產生，所以改了要重新建置。
 *
 * 功能開關的舊名稱（NEXT_PUBLIC_FEATURE_*）仍然認得，方便既有的 .env 繼續用。
 */
const flag = (name: string) => (process.env[`FEATURE_${name}`] ?? process.env[`NEXT_PUBLIC_FEATURE_${name}`]) === "1";
const buildTime = {
  "process.env.FEATURE_LOGIN": JSON.stringify(flag("LOGIN") ? "1" : ""),
  "process.env.FEATURE_LEADERBOARD": JSON.stringify(flag("LEADERBOARD") ? "1" : ""),
  "process.env.FEATURE_PLAY_COUNT": JSON.stringify(flag("PLAY_COUNT") ? "1" : ""),
  "process.env.ADS_MODE": JSON.stringify(process.env.ADS_MODE ?? "mock"),
  "process.env.SITE_URL": JSON.stringify(process.env.SITE_URL ?? "http://localhost:3000"),
};

export default defineNuxtConfig({
  compatibilityDate: "2026-11-01",
  devtools: { enabled: false },
  // lib/、generated/ 在專案根目錄，沿用原本 @/ 指到根目錄的寫法
  alias: { "@": root },

  modules: ["@nuxt/fonts", "@nuxt/eslint"],
  // 頁面沒有非同步資料，換頁時不需要另外下載預先產生的 _payload.json
  experimental: { payloadExtraction: false },
  // 元件用檔名直接使用（<GameCard>），不加資料夾前綴；只掃 .vue
  components: [{ path: "~/components", pathPrefix: false, extensions: ["vue"] }],
  css: ["~/assets/css/main.css"],

  app: {
    head: {
      meta: [{ name: "theme-color", content: "#1d3a8f" }],
      link: [{ rel: "icon", href: "/favicon.ico", sizes: "any" }],
    },
  },

  /*
   * 字型在建置時下載、跟著網站一起提供（不在執行時連 Google Fonts）。
   * 中日韓字型很大，靠 unicode-range 按需下載，不預載。
   */
  fonts: {
    defaults: { preload: false, styles: ["normal"] },
    families: [
      // 圓體的可變字重 Google 只提供切片的 TTF（和原本 next/font 拿到的一樣），所以這一款也收 TTF
      { name: "Chiron GoRound TC", provider: "google", weights: ["200 900"], formats: ["woff2", "ttf"], global: true },
      { name: "Noto Sans SC", provider: "google", weights: [400, 700, 900], global: true },
      { name: "Noto Sans KR", provider: "google", weights: [400, 700, 900], global: true },
      {
        name: "Nunito",
        provider: "google",
        weights: [400, 700, 900],
        subsets: ["latin", "latin-ext", "vietnamese"],
        global: true,
      },
    ],
  },

  vite: {
    plugins: [tailwindcss()],
    define: buildTime,
    // 開發時先把遊戲引擎預先打包，第一次按出發時不會因為發現新依賴而整頁重新載入
    optimizeDeps: { include: ["phaser", "zod"] },
    server: {
      // 開發模式允許區網裝置（手機測試）連線
      allowedHosts: ["192.168.0.16"],
    },
  },

  nitro: {
    preset: "cloudflare_module",
    // wrangler.jsonc 由專案自己維護（binding、D1、排程、限流都在裡面），不另外產生
    cloudflare: { deployConfig: false, nodeCompat: true },
    replace: buildTime,
    // 成績圖用到的 WebAssembly（satori 的排版引擎、resvg）以模組方式匯入，Workers 才能執行
    experimental: { wasm: true },
    /*
     * 正式建置改用 server/cloudflare-entry.ts 當 Workers 入口：在 Nitro 讀進請求內容前先檢查大小。
     * 用模組在設定解析後才換入口：開發（nitro-dev）和預先產生頁面（nitro-prerender）會複製同一份設定，
     * 直接寫 entry 的話它們也會用到這個入口而壞掉。
     * 升級 nitropack 後要確認 dist/presets/cloudflare/runtime/cloudflare-module.mjs 還在（npm run preview 會失敗）。
     */
    modules: [
      (nitro) => {
        if (nitro.options.preset !== "cloudflare-module") return;
        nitro.options.alias["#nitro-cloudflare-module"] = join(nitroDir, "dist/presets/cloudflare/runtime/cloudflare-module.mjs");
        nitro.options.entry = join(root, "server/cloudflare-entry.ts");
      },
    ],
    // 內容不會隨請求改變的頁面在建置時產生，從 Cloudflare 的靜態資源直接提供（清單見 lib/routes.ts）
    prerender: {
      crawlLinks: false,
      routes: prerenderRoutes(),
    },
    typescript: {
      tsConfig: {
        compilerOptions: { noUncheckedIndexedAccess: false },
        // wrangler types 產生的 binding 型別（CloudflareEnv、D1Database……）
        include: ["../cloudflare-env.d.ts"],
      },
    },
  },

  // 只在開發時：見 app/dev/devtools-api-stub.ts
  $development: {
    vite: {
      resolve: { alias: { "@vue/devtools-api": fileURLToPath(new URL("./app/dev/devtools-api-stub.ts", import.meta.url)) } },
    },
  },

  typescript: {
    tsConfig: {
      // 沿用原本的 TypeScript 設定（lib/ 的程式是照這個寫的）
      compilerOptions: { noUncheckedIndexedAccess: false, noImplicitOverride: false },
      include: ["../lib/**/*", "../generated/**/*"],
    },
    nodeTsConfig: { include: ["../tests/**/*", "../scripts/**/*", "../*.config.ts", "../*.config.mts"] },
  },
});
