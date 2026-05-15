import { describe, it, expect } from "vitest";
import { isValidSupplyPoint22 } from "../soil-types";

describe("isValidSupplyPoint22", () => {
  it("22 桁の数字のみは true", () => {
    expect(isValidSupplyPoint22("0123456789012345678901")).toBe(true);
  });

  it("22 桁ぴったりでない場合は false（21 桁）", () => {
    expect(isValidSupplyPoint22("012345678901234567890")).toBe(false);
  });

  it("22 桁ぴったりでない場合は false（23 桁）", () => {
    expect(isValidSupplyPoint22("01234567890123456789012")).toBe(false);
  });

  it("英字を含む場合は false", () => {
    expect(isValidSupplyPoint22("A123456789012345678901")).toBe(false);
  });

  it("ハイフンを含む場合は false", () => {
    expect(isValidSupplyPoint22("0123456789012345-67890")).toBe(false);
  });

  it("null / undefined は false", () => {
    expect(isValidSupplyPoint22(null)).toBe(false);
    expect(isValidSupplyPoint22(undefined)).toBe(false);
  });

  it("空文字は false", () => {
    expect(isValidSupplyPoint22("")).toBe(false);
  });

  it("全角数字は false", () => {
    expect(isValidSupplyPoint22("０１２３４５６７８９０１２３４５６７８９０１２３")).toBe(false);
  });
});
