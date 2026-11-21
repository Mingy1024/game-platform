import { describe, expect, it } from "vitest";
import { rememberedHomePath } from "../locales";

describe("K3 首頁沿用使用者選過的語言", () => {
  it("選過有前綴的語言時轉到該語言的首頁", () => {
    expect(rememberedHomePath("en")).toBe("/en");
    expect(rememberedHomePath("zh-CN")).toBe("/zh-cn");
  });

  it("選繁體中文、沒選過或值不對時不轉址", () => {
    for (const value of ["zh-TW", undefined, null, "", "xx", "EN", "/evil"]) {
      expect(rememberedHomePath(value), String(value)).toBeNull();
    }
  });
});
