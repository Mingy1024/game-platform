import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * 讀 public/ 底下的檔案（伺服器端用，例如成績圖的字型和背景圖）。
 *
 * Cloudflare Workers 沒有檔案系統，改向靜態資源（ASSETS binding）要檔案；
 * 本機 next dev 和測試沒有 ASSETS，直接讀硬碟。
 *
 * @param path public/ 底下的路徑，開頭是 /，例如 /share-card/hero.jpg
 */
export async function readStaticAsset(path: string): Promise<Uint8Array> {
  const assetsBinding = workersAssets();
  if (assetsBinding) {
    const response = await assetsBinding.fetch(new URL(path, "https://assets.invalid"));
    if (!response.ok) throw new Error(`讀不到靜態檔案 ${path}（${response.status}）`);
    return new Uint8Array(await response.arrayBuffer());
  }
  // turbopackIgnore：不要讓檔案追蹤把整個專案打包進 Worker（這段只在本機執行）
  return readFile(join(/* turbopackIgnore: true */ process.cwd(), "public", path));
}

function workersAssets(): { fetch(input: URL): Promise<Response> } | null {
  try {
    return getCloudflareContext().env.ASSETS ?? null;
  } catch {
    // 不在 Workers 裡（next dev、vitest）
    return null;
  }
}
