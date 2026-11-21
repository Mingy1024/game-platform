/**
 * 請求內容的整體上限，在 Nitro 讀取請求內容之前檢查（server/cloudflare-entry.ts）。
 * Nitro 的 Cloudflare 入口會先把整個請求內容讀進記憶體，才交給路由；
 * Cloudflare 允許單一請求到 100 MB，128 MB 的記憶體又是同一個 isolate 的並行請求共用，
 * 不先擋的話，一個大請求在任何檢查（登入、限流）之前就能占掉大量記憶體。
 *
 * 本站沒有上傳功能，會帶內容的請求只有暱稱 API（JSON 遠小於 1 KB）和精準停車的紀錄同步（上限 8 KB），16 KB 綽綽有餘。
 * 個別 API 還有自己更嚴的上限（server/api/me/nick.patch.ts 的 1 KB、紀錄同步的 8 KB）。
 */
export const MAX_REQUEST_BODY_BYTES = 16 * 1024;

const tooLarge = () =>
  new Response(JSON.stringify({ error: "bad_request" }), {
    status: 413,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

/**
 * 有宣告 Content-Length：超過上限直接回 413，不讀內容（Cloudflare 收到的內容不會超過宣告的長度）。
 * 沒有宣告（分段傳送）：邊讀邊數，超過上限就停止讀取並回 413；沒超過就用讀到的內容建立新的請求。
 * 回傳 Response 表示拒絕；回傳 Request 表示可以繼續處理。
 */
export async function limitRequestBody(request: Request, max = MAX_REQUEST_BODY_BYTES): Promise<Request | Response> {
  if (!request.body) return request;
  const header = request.headers.get("content-length");
  if (header !== null) {
    const declared = Number(header);
    if (!Number.isFinite(declared) || declared < 0) return tooLarge();
    return declared > max ? tooLarge() : request;
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      return tooLarge();
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Request(request, { body });
}
