import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // 開發模式允許區網裝置（手機測試）載入 /_next 資源
  allowedDevOrigins: ["192.168.0.16"],
  // Cache Components 在 Cloudflare Workers（OpenNext）上還不支援，開了頁面會卡住，所以先關掉
  // 檔案追蹤不要把開發、建置用的工具打包進 Worker。
  // Prisma Client 會設定 globalThis.__dirname = "/"，讓追蹤以為整個專案都會用到；
  // 這些套件執行時用不到（網站的程式都已經打包進 .next 的 chunks）。
  outputFileTracingExcludes: {
    "*": [
      "node_modules/@cloudflare/**",
      "node_modules/workerd/**",
      "node_modules/wrangler/**",
      "node_modules/miniflare/**",
      "node_modules/cloudflare/**",
      "node_modules/prisma/**",
      "node_modules/@prisma/engines/**",
      "node_modules/@prisma/studio-core/**",
      "node_modules/@prisma/dev/**",
      "node_modules/@prisma/fetch-engine/**",
      "node_modules/@prisma/get-platform/**",
      "node_modules/@electric-sql/**",
      "node_modules/phaser/**",
      "node_modules/@next/swc-*/**",
      "node_modules/next/next-swc-fallback/**",
      "node_modules/@rolldown/**",
      "node_modules/esbuild/**",
      "node_modules/@esbuild/**",
      "node_modules/lightningcss*/**",
      "node_modules/@tailwindcss/**",
      "node_modules/tailwindcss/**",
      "node_modules/@ast-grep/**",
      "node_modules/typescript/**",
      "node_modules/eslint*/**",
      "node_modules/@eslint/**",
      "node_modules/@typescript-eslint/**",
      "node_modules/@playwright/**",
      "node_modules/playwright*/**",
      "node_modules/vitest/**",
      "node_modules/@vitest/**",
      "node_modules/vite/**",
      "node_modules/effect/**",
      "node_modules/@img/**",
      "node_modules/sharp/**",
      "node_modules/caniuse-lite/**",
      "node_modules/es-abstract/**",
      "node_modules/elkjs/**",
      "node_modules/@aws-sdk/**",
      "node_modules/@aws-crypto/**",
    ],
  },
  experimental: {
    // 網站有兩個根版面（繁中、其他語言），404 頁由 app/global-not-found.tsx 提供
    globalNotFound: true,
  },
  turbopack: {
    resolveAlias: {
      // 用 D1 adapter 的 Workers 版。Node 版裡有讀 process.cwd() 底下 .wrangler 的開發用程式，
      // 會讓檔案追蹤把整個專案（含 node_modules）打包進 Worker，壓縮後超過 19 MB
      "@prisma/adapter-d1": "./node_modules/@prisma/adapter-d1/dist/index-workerd.mjs",
    },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

// next dev 時提供 wrangler.jsonc 裡的 binding（本機 D1 等），讓 getCloudflareContext() 可用
initOpenNextCloudflareForDev();
