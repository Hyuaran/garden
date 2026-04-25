/**
 * Garden Root — プリミティブバリデーターヘルパー 単体テスト
 *
 * 対象:
 *   isDigits / isKatakana / isEmail / isPhone /
 *   isYearMonth / isFiscalYear / isInRange / isNonNegative /
 *   hasErrors / VALIDATION_ERROR_BANNER
 */

import { describe, it, expect } from "vitest";
import {
  isDigits,
  isKatakana,
  isEmail,
  isPhone,
  isYearMonth,
  isFiscalYear,
  isInRange,
  isNonNegative,
  hasErrors,
  VALIDATION_ERROR_BANNER,
} from "@/app/root/_lib/validators";

// ------------------------------------------------------------
// isDigits
// ------------------------------------------------------------
describe("isDigits", () => {
  it("accepts exact-length numeric string", () => {
    expect(isDigits("1234", 4)).toBe(true);
  });

  it("accepts single digit with n=1", () => {
    expect(isDigits("7", 1)).toBe(true);
  });

  it("accepts 7-digit account number", () => {
    expect(isDigits("0036251", 7)).toBe(true);
  });

  it("rejects string shorter than n", () => {
    expect(isDigits("123", 4)).toBe(false);
  });

  it("rejects string longer than n", () => {
    expect(isDigits("12345", 4)).toBe(false);
  });

  it("rejects string with non-digit characters", () => {
    expect(isDigits("12a4", 4)).toBe(false);
  });

  it("rejects empty string when n > 0", () => {
    expect(isDigits("", 4)).toBe(false);
  });

  it("accepts empty string when n = 0", () => {
    expect(isDigits("", 0)).toBe(true);
  });

  it("rejects full-width digits (not ASCII \\d)", () => {
    expect(isDigits("\uff11\uff12\uff13\uff14", 4)).toBe(false);
  });

  it("rejects string with spaces", () => {
    expect(isDigits("12 4", 4)).toBe(false);
  });
});

// ------------------------------------------------------------
// isKatakana
// ------------------------------------------------------------
describe("isKatakana", () => {
  it("accepts standard katakana", () => {
    expect(isKatakana("ヤマダ")).toBe(true);
  });

  it("accepts katakana with half-width space", () => {
    expect(isKatakana("ヤマダ タロウ")).toBe(true);
  });

  it("accepts katakana with full-width space", () => {
    expect(isKatakana("ヤマダ\u3000タロウ")).toBe(true);
  });

  it("accepts katakana with chōonpu (ー)", () => {
    expect(isKatakana("ヤマー")).toBe(true);
  });

  it("accepts empty string (empty → true)", () => {
    expect(isKatakana("")).toBe(true);
  });

  it("rejects hiragana", () => {
    expect(isKatakana("やまだ")).toBe(false);
  });

  it("rejects romaji (ASCII)", () => {
    expect(isKatakana("YAMADA")).toBe(false);
  });

  it("rejects kanji", () => {
    expect(isKatakana("山田")).toBe(false);
  });

  it("rejects mixed katakana and hiragana", () => {
    expect(isKatakana("ヤマだ")).toBe(false);
  });

  it("rejects half-width katakana (ｱ is outside range)", () => {
    // ｱ is U+FF71, outside \u30A0-\u30FF block
    expect(isKatakana("ｱｲｳ")).toBe(false);
  });
});

// ------------------------------------------------------------
// isEmail
// ------------------------------------------------------------
describe("isEmail", () => {
  it("accepts simple valid email", () => {
    expect(isEmail("a@b.c")).toBe(true);
  });

  it("accepts email with plus tag and multi-part TLD", () => {
    expect(isEmail("name+tag@example.co.jp")).toBe(true);
  });

  it("accepts typical company email", () => {
    expect(isEmail("taro@hyuaran.com")).toBe(true);
  });

  it("rejects string without @ symbol", () => {
    expect(isEmail("abc")).toBe(false);
  });

  it("rejects string with @ but no dot in domain part", () => {
    expect(isEmail("a@b")).toBe(false);
  });

  it("rejects email with space before @", () => {
    expect(isEmail("a @b.c")).toBe(false);
  });

  it("rejects email with space after @", () => {
    expect(isEmail("a@ b.c")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isEmail("")).toBe(false);
  });

  it("rejects string starting with @", () => {
    expect(isEmail("@b.c")).toBe(false);
  });
});

// ------------------------------------------------------------
// isPhone
// ------------------------------------------------------------
describe("isPhone", () => {
  it("accepts null (returns true)", () => {
    expect(isPhone(null)).toBe(true);
  });

  it("accepts undefined (returns true)", () => {
    expect(isPhone(undefined)).toBe(true);
  });

  it("accepts empty string (falsy → true)", () => {
    expect(isPhone("")).toBe(true);
  });

  it("accepts standard landline with hyphens", () => {
    expect(isPhone("03-1234-5678")).toBe(true);
  });

  it("accepts mobile number with spaces", () => {
    expect(isPhone("090 1234 5678")).toBe(true);
  });

  it("accepts international format with +81", () => {
    expect(isPhone("+81-90-1234-5678")).toBe(true);
  });

  it("accepts number with parentheses", () => {
    expect(isPhone("(03) 1234-5678")).toBe(true);
  });

  it("accepts digits only", () => {
    expect(isPhone("0312345678")).toBe(true);
  });

  it("rejects phone containing letters", () => {
    expect(isPhone("03-abc-5678")).toBe(false);
  });

  it("rejects phone containing at-sign", () => {
    expect(isPhone("03@1234-5678")).toBe(false);
  });
});

// ------------------------------------------------------------
// isYearMonth
// ------------------------------------------------------------
describe("isYearMonth", () => {
  it("accepts valid mid-year month", () => {
    expect(isYearMonth("2026-04")).toBe(true);
  });

  it("accepts December (max month 12)", () => {
    expect(isYearMonth("2026-12")).toBe(true);
  });

  it("accepts January (min month 01)", () => {
    expect(isYearMonth("2026-01")).toBe(true);
  });

  it("rejects month 13 (out of range)", () => {
    expect(isYearMonth("2026-13")).toBe(false);
  });

  it("rejects month 00", () => {
    expect(isYearMonth("2026-00")).toBe(false);
  });

  it("rejects month without zero-padding", () => {
    expect(isYearMonth("2026-4")).toBe(false);
  });

  it("rejects full date string YYYY-MM-DD", () => {
    expect(isYearMonth("2026-04-25")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isYearMonth("")).toBe(false);
  });

  it("rejects string without hyphen", () => {
    expect(isYearMonth("202604")).toBe(false);
  });
});

// ------------------------------------------------------------
// isFiscalYear
// ------------------------------------------------------------
describe("isFiscalYear", () => {
  it("accepts typical 4-digit year", () => {
    expect(isFiscalYear("2026")).toBe(true);
  });

  it("accepts zero-padded year 0001", () => {
    expect(isFiscalYear("0001")).toBe(true);
  });

  it("accepts year 9999", () => {
    expect(isFiscalYear("9999")).toBe(true);
  });

  it("rejects 2-digit year", () => {
    expect(isFiscalYear("26")).toBe(false);
  });

  it("rejects 5-digit year", () => {
    expect(isFiscalYear("20260")).toBe(false);
  });

  it("rejects alphabetic string of length 4", () => {
    expect(isFiscalYear("abcd")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isFiscalYear("")).toBe(false);
  });

  it("rejects year with hyphen", () => {
    expect(isFiscalYear("2026-")).toBe(false);
  });
});

// ------------------------------------------------------------
// isInRange
// ------------------------------------------------------------
describe("isInRange", () => {
  it("accepts value at min boundary", () => {
    expect(isInRange(0, 0, 10)).toBe(true);
  });

  it("accepts value at max boundary", () => {
    expect(isInRange(10, 0, 10)).toBe(true);
  });

  it("accepts midpoint value", () => {
    expect(isInRange(5, 0, 10)).toBe(true);
  });

  it("accepts decimal within range", () => {
    expect(isInRange(1.25, 1, 3)).toBe(true);
  });

  it("accepts min = max (single value range)", () => {
    expect(isInRange(5, 5, 5)).toBe(true);
  });

  it("rejects value below min", () => {
    expect(isInRange(-1, 0, 10)).toBe(false);
  });

  it("rejects value above max", () => {
    expect(isInRange(11, 0, 10)).toBe(false);
  });

  it("rejects Infinity", () => {
    expect(isInRange(Infinity, 0, 1000)).toBe(false);
  });

  it("rejects -Infinity", () => {
    expect(isInRange(-Infinity, -1000, 0)).toBe(false);
  });

  it("rejects NaN", () => {
    expect(isInRange(NaN, 0, 10)).toBe(false);
  });
});

// ------------------------------------------------------------
// isNonNegative
// ------------------------------------------------------------
describe("isNonNegative", () => {
  it("accepts zero", () => {
    expect(isNonNegative(0)).toBe(true);
  });

  it("accepts positive integer", () => {
    expect(isNonNegative(100)).toBe(true);
  });

  it("accepts positive decimal", () => {
    expect(isNonNegative(0.001)).toBe(true);
  });

  it("rejects negative number", () => {
    expect(isNonNegative(-1)).toBe(false);
  });

  it("rejects negative decimal", () => {
    expect(isNonNegative(-0.001)).toBe(false);
  });

  it("rejects Infinity (not finite)", () => {
    expect(isNonNegative(Infinity)).toBe(false);
  });

  it("rejects NaN", () => {
    expect(isNonNegative(NaN)).toBe(false);
  });

  it("rejects -Infinity", () => {
    expect(isNonNegative(-Infinity)).toBe(false);
  });
});

// ------------------------------------------------------------
// hasErrors
// ------------------------------------------------------------
describe("hasErrors", () => {
  it("returns false for empty error object", () => {
    expect(hasErrors({})).toBe(false);
  });

  it("returns true when there is at least one error", () => {
    expect(hasErrors({ field: "エラーメッセージ" })).toBe(true);
  });

  it("returns true for multiple errors", () => {
    expect(hasErrors({ name: "必須", email: "メール形式" })).toBe(true);
  });
});

// ------------------------------------------------------------
// VALIDATION_ERROR_BANNER
// ------------------------------------------------------------
describe("VALIDATION_ERROR_BANNER", () => {
  it("is a non-empty string", () => {
    expect(typeof VALIDATION_ERROR_BANNER).toBe("string");
    expect(VALIDATION_ERROR_BANNER.length).toBeGreaterThan(0);
  });

  it("contains 入力エラー", () => {
    expect(VALIDATION_ERROR_BANNER).toContain("入力エラー");
  });

  it("matches exact banner text", () => {
    expect(VALIDATION_ERROR_BANNER).toBe(
      "入力エラーがあります。赤枠の項目を確認してください。"
    );
  });
});
