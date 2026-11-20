import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".scratch/**",
    ".claude/**",
    "test-results/**",
    "playwright-report/**",
    ".open-next/**",
    ".wrangler/**",
    // wrangler types 產生的檔案
    "cloudflare-env.d.ts",
  ]),
]);

export default eslintConfig;
