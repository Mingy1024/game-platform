import { describe, expect, it } from "vitest";
import { LOCALES } from "@/lib/i18n/locales";
import { nickParts, nickText, randomNick } from "../nick/nick";
import { checkNickFormat, cleanNick, nickKey, nickLength, nickNextAt, NICK_COOLDOWN_MS } from "../nick/rules";
import { ADJECTIVES, NOUNS } from "../nick/words";

describe("隨機暱稱", () => {
  const nick = { adj: 0, noun: 0, num: 427, custom: null };

  it("依語言排列形容詞和名詞，四位數補零", () => {
    expect(nickText(nick, "zh-TW")).toBe("準點的月台 0427");
    expect(nickText(nick, "en")).toBe("Punctual Platform 0427");
    expect(nickText(nick, "ja")).toBe("定刻のホーム 0427");
    expect(nickText(nick, "ko")).toBe("정시의 승강장 0427");
    expect(nickText(nick, "vi")).toBe("Sân Ga Đúng Giờ 0427");
    expect(nickText(nick, "pt")).toBe("Plataforma Pontual 0427");
  });

  it("自訂暱稱不顯示四位數", () => {
    expect(nickParts({ ...nick, custom: "阿明號" }, "en")).toEqual({ name: "阿明號", number: null });
  });

  it("詞庫每種語言都有翻譯、沒有空字串，形容詞和名詞各 32 個", () => {
    expect(ADJECTIVES).toHaveLength(32);
    expect(NOUNS).toHaveLength(32);
    for (const word of [...ADJECTIVES, ...NOUNS]) {
      for (const locale of LOCALES) expect(word[locale].trim()).not.toBe("");
    }
  });

  it("每個語言的隨機名字都符合自訂暱稱以外的長度上限（不會長到版面放不下）", () => {
    for (const locale of LOCALES) {
      for (let adj = 0; adj < ADJECTIVES.length; adj++) {
        for (let noun = 0; noun < NOUNS.length; noun++) {
          expect(nickParts({ adj, noun, num: 0, custom: null }, locale).name.length).toBeLessThanOrEqual(32);
        }
      }
    }
  });

  it("隨機產生的編號在範圍內", () => {
    const values = randomNick((max) => max - 1);
    expect(values).toEqual({ adj: 31, noun: 31, num: 9999 });
  });
});

describe("自訂暱稱規則", () => {
  const check = (value: string) => checkNickFormat(cleanNick(value));

  it("2 到 12 個字，以看到的字元計算", () => {
    expect(check("阿")).toBe("length");
    expect(check("阿明")).toBeNull();
    expect(check("一二三四五六七八九十一二")).toBeNull();
    expect(check("一二三四五六七八九十一二三")).toBe("length");
    expect(nickLength("Tiếng")).toBe(5);
    expect(nickLength("👨‍👩‍👧")).toBe(1);
  });

  it("只能用中英日韓文字、數字、空格和 · - _ .，至少要有一個文字", () => {
    expect(check("Mina_01")).toBeNull();
    expect(check("ミナ・ホーム")).toBeNull();
    expect(check("스테이션 러버")).toBeNull();
    expect(check("Đúng Giờ")).toBeNull();
    expect(check("阿明!!")).toBe("chars");
    expect(check("火車🚆")).toBe("chars");
    expect(check("1234")).toBe("chars");
    expect(check("<b>阿明</b>")).toBe("chars");
  });

  it("結尾不能是空格＋四位數（冒充隨機暱稱）", () => {
    expect(check("月台 0427")).toBe("blocked");
    expect(check("月台0427")).toBeNull();
  });

  it("不能放網址或電話", () => {
    expect(check("httpgo")).toBe("blocked");
    expect(check("www站")).toBe("blocked");
    expect(check("abc.com")).toBe("blocked");
    expect(check("打0912345678")).toBe("blocked");
    expect(check("打 09123-4567")).toBe("blocked");
    expect(check("車站123456")).toBeNull();
  });

  it("禁字表：去掉空白和符號後比對，不分大小寫", () => {
    expect(check("管 理 員")).toBe("blocked");
    expect(check("A.d.m.i.n")).toBe("blocked");
    expect(check("官方小編")).toBe("blocked");
    expect(check("月台小編")).toBeNull();
  });

  it("全形轉半形、整理空白；比對值不分大小寫和空白", () => {
    expect(cleanNick("  Ｍｉｎａ　　Go  ")).toBe("Mina Go");
    expect(nickKey("Mina Go")).toBe(nickKey("mina   go"));
    expect(nickKey("Ｍｉｎａ")).toBe("mina");
  });

  it("7 天冷卻", () => {
    const now = new Date("2026-11-20T00:00:00Z");
    expect(nickNextAt(null, now)).toBeNull();
    const changed = new Date("2026-11-19T00:00:00Z");
    expect(nickNextAt(changed, now)?.getTime()).toBe(changed.getTime() + NICK_COOLDOWN_MS);
    expect(nickNextAt(new Date("2026-11-12T00:00:00Z"), now)).toBeNull();
  });
});
