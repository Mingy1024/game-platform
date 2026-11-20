import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // 開發模式允許區網裝置（手機測試）載入 /_next 資源
  allowedDevOrigins: ["192.168.0.16"],
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // 網站有兩個根版面（繁中、其他語言），404 頁由 app/global-not-found.tsx 提供
    globalNotFound: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
