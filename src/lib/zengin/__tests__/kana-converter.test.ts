import { describe, it, expect } from "vitest";
import { toHalfWidthKana } from "../kana-converter";

describe("toHalfWidthKana", () => {
  it("全角カタカナを半角カタカナに変換する", () => {
    const result = toHalfWidthKana("ヤマダ タロウ");
    expect(result.kana).toBe("ﾔﾏﾀﾞ ﾀﾛｳ");
    expect(result.warnings).toEqual([]);
  });

  it("濁点・半濁点を適切に分解する", () => {
    const result = toHalfWidthKana("ガギグゲゴパピプペポ");
    expect(result.kana).toBe("ｶﾞｷﾞｸﾞｹﾞｺﾞﾊﾟﾋﾟﾌﾟﾍﾟﾎﾟ");
  });

  it("ひらがなは自動で全角カタカナ経由で半角カタカナに変換する", () => {
    const result = toHalfWidthKana("やまだ");
    expect(result.kana).toBe("ﾔﾏﾀﾞ");
  });

  it("全角英数字を半角に変換する", () => {
    const result = toHalfWidthKana("ABC123");
    expect(result.kana).toBe("ABC123");
  });

  it("半角英数字はそのまま通す", () => {
    const result = toHalfWidthKana("ABC123");
    expect(result.kana).toBe("ABC123");
  });

  it("許可記号（.-()/,）はそのまま通す", () => {
    const result = toHalfWidthKana("カ)ヤマダ.ABC-123(1)");
    expect(result.kana).toBe("ｶ)ﾔﾏﾀﾞ.ABC-123(1)");
  });

  it("漢字は変換できないので警告を出し、該当文字を除去する", () => {
    const result = toHalfWidthKana("山田太郎");
    expect(result.kana).toBe("");
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("変換不能");
  });

  it("空文字列は空文字列を返す", () => {
    const result = toHalfWidthKana("");
    expect(result.kana).toBe("");
    expect(result.warnings).toEqual([]);
  });

  it("前後の空白をトリムする", () => {
    const result = toHalfWidthKana("  ヤマダ  ");
    expect(result.kana).toBe("ﾔﾏﾀﾞ");
  });
});
