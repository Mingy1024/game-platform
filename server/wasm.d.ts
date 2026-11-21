// nitro.experimental.wasm：以 ?module 匯入 .wasm 會拿到 WebAssembly.Module
declare module "*.wasm?module" {
  const module: WebAssembly.Module;
  export default module;
}

// Nitro 原本的 cloudflare_module 入口（nuxt.config.ts 的 nitro.modules 設定別名），server/cloudflare-entry.ts 包住它
declare module "#nitro-cloudflare-module" {
  const handler: unknown;
  export default handler;
}
