import { describe, expect, it } from "vitest";
import { safeReturnPath, withLoginResult } from "../return-path";

describe("登入後回去的網址", () => {
  it("站內路徑照原樣保留，含查詢參數和錨點", () => {
    expect(safeReturnPath("/games/precise-stop")).toBe("/games/precise-stop");
    expect(safeReturnPath("/en/games/precise-stop?mode=free#records")).toBe("/en/games/precise-stop?mode=free#records");
  });

  it("站外網址、協定相對網址、怪字元一律回首頁", () => {
    for (const bad of [
      null,
      "",
      "https://evil.example/",
      "//evil.example/",
      "/\\evil.example",
      "\\\\evil.example",
      "javascript:alert(1)",
      "games",
      "/games\n/evil",
      "/" + "a".repeat(600),
    ]) {
      expect(safeReturnPath(bad)).toBe("/");
    }
  });

  it("加上 login 參數，保留原本的參數", () => {
    expect(withLoginResult("/games/precise-stop", "ok")).toBe("/games/precise-stop?login=ok");
    expect(withLoginResult("/me?tab=a#x", "error")).toBe("/me?tab=a&login=error#x");
    expect(withLoginResult("https://evil.example/", "ok")).toBe("/?login=ok");
  });
});
