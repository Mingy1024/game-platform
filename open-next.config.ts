import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// 網站沒有用 revalidate／use cache，預先產生的頁面直接從靜態資源讀，不需要 R2
const config = defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});

// 直接用目前的 node 執行 next：WSL 下 node_modules/.bin/next 會改叫 Windows 的 node.exe，
// OpenNext 設定的環境變數（standalone 輸出）就傳不過去
config.buildCommand = "node ./node_modules/next/dist/bin/next build";

export default config;
