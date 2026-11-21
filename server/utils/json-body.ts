import { getRequestHeader, readRawBody, type H3Event } from "h3";

/**
 * 讀取並解析 JSON 請求內容，超過 max 位元組就拒絕。
 * 瀏覽器送 JSON 一定帶 Content-Length；沒有（411）或超過（413）就拒絕，讀進來後再用實際長度檢查一次。
 * （整體大小在 Nitro 讀取前已由 server/body-limit.ts 擋過；這裡確保超過個別上限的內容不會被解析。）
 * 格式不對回 400。成功時回傳 { body }。
 */
export async function readJsonBody(event: H3Event, max: number): Promise<{ body: unknown } | 400 | 411 | 413> {
  const header = getRequestHeader(event, "content-length");
  if (header === undefined) return 411;
  const declared = Number(header);
  if (!Number.isFinite(declared) || declared < 0) return 400;
  if (declared > max) return 413;
  const raw = await readRawBody(event, false).catch(() => undefined);
  if (raw && raw.byteLength > max) return 413;
  try {
    return { body: JSON.parse(new TextDecoder().decode(raw ?? new Uint8Array())) as unknown };
  } catch {
    return 400;
  }
}
