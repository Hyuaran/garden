import { describe, expect, it } from "vitest";

import { normalizePartnerCode, toTossEmail } from "../identity";

describe("toss partner identity", () => {
  it("7桁コードを専用ドメインの合成メールへ変換する", () => {
    expect(toTossEmail("1234567")).toBe("toss1234567@toss.garden.internal");
  });

  it("前後の空白を除去する", () => {
    expect(normalizePartnerCode(" 1234567 ")).toBe("1234567");
  });

  it.each(["123456", "12345678", "１２３４５６７", "abcdefg"])("不正コード %s を拒否する", (code) => {
    expect(() => toTossEmail(code)).toThrow("半角数字7桁");
  });
});
