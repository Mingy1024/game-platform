import { getRequestURL, type H3Event } from "h3";

/**
 * 讀 public/ 底下的檔案（伺服器端用，例如成績圖的字型和背景圖）。
 *
 * Workers 沒有檔案系統，改向靜態資源（ASSETS binding）要檔案；
 * 本機 nuxt dev 沒有 ASSETS，就向開發伺服器自己要（public/ 由開發伺服器提供）。
 *
 * @param path public/ 底下的路徑，開頭是 /，例如 /share-card/hero.jpg
 */
export async function readStaticAsset(event: H3Event, path: string): Promise<Uint8Array> {
  // 開發時 wrangler 提供的 ASSETS 指向上次建置的 .output/public，可能是舊的，所以不用
  const assets = import.meta.dev ? undefined : cloudflareEnv(event).ASSETS;
  const response = assets
    ? await assets.fetch(new URL(path, "https://assets.invalid"))
    : await fetch(new URL(path, getRequestURL(event).origin));
  if (!response.ok) throw new Error(`讀不到靜態檔案 ${path}（${response.status}）`);
  return new Uint8Array(await response.arrayBuffer());
}
