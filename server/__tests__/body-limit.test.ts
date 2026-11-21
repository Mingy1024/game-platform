import { describe, expect, it } from "vitest";
import { limitRequestBody } from "../body-limit";

const url = "https://games.example.com/api/me/nick";

/** 帶 Content-Length 的請求（Workers 收到的請求會保留用戶端送來的標頭；Node 的 Request 不會自己加） */
const declared = (body: string, length = new TextEncoder().encode(body).byteLength) =>
  new Request(url, { method: "PATCH", body, headers: { "content-length": String(length) } });

/** 不帶 Content-Length、分段送出的請求 */
function chunked(chunks: Uint8Array[]): Request {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  return new Request(url, { method: "PATCH", body: stream, duplex: "half" } as RequestInit);
}

describe("請求內容大小上限（Nitro 讀取前）", () => {
  it("沒有內容的請求直接通過", async () => {
    const request = new Request(url);
    expect(await limitRequestBody(request, 10)).toBe(request);
  });

  it("宣告的長度在上限內：原請求通過", async () => {
    const request = declared("12345");
    expect(await limitRequestBody(request, 10)).toBe(request);
  });

  it("宣告的長度超過上限：413，不讀內容", async () => {
    const request = declared("x".repeat(11));
    const result = await limitRequestBody(request, 10);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(413);
    expect(request.bodyUsed).toBe(false);
  });

  it("沒有宣告長度、實際內容在上限內：用讀到的內容建立新請求", async () => {
    const result = await limitRequestBody(chunked([new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])]), 10);
    expect(result).toBeInstanceOf(Request);
    expect(new Uint8Array(await (result as Request).arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
    expect((result as Request).method).toBe("PATCH");
  });

  it("沒有宣告長度、實際內容超過上限：413", async () => {
    const result = await limitRequestBody(chunked([new Uint8Array(6), new Uint8Array(6)]), 10);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(413);
  });
});
