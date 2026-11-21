import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // 和 nuxt.config.ts 的 alias 一致：@ 指到專案根目錄
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["**/*.{test,spec}.ts"],
    exclude: ["node_modules/**", ".nuxt/**", ".output/**", ".wrangler/**", ".scratch/**", "tests/e2e/**"],
  },
});
