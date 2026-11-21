// @ts-check
import withNuxt from "./.nuxt/eslint.config.mjs";

export default withNuxt({
  ignores: [
    ".scratch/**",
    ".claude/**",
    "test-results/**",
    "playwright-report/**",
    ".wrangler/**",
    "generated/**",
    // wrangler types 產生的檔案
    "cloudflare-env.d.ts",
  ],
}).override("nuxt/vue/rules", {
  rules: {
    // 元件名稱沿用原本的單字命名（Hud、Banner……）
    "vue/multi-word-component-names": "off",
    // props 用 TypeScript 的可選型別（undefined 就是預設值），不另外寫 default
    "vue/require-default-prop": "off",
  },
});
