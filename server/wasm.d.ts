// nitro.experimental.wasm：以 ?module 匯入 .wasm 會拿到 WebAssembly.Module
declare module "*.wasm?module" {
  const module: WebAssembly.Module;
  export default module;
}
