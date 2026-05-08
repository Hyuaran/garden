import { describe, it, expect } from "vitest";
import { padRight, padLeftZero } from "../padding";

describe("padRight", () => {
  it("短い文字列は右側空白埋め", () => {
    expect(padRight("ABC", 5)).toBe("ABC  ");
  });

  it("ちょうどの長さはそのまま", () => {
    expect(padRight("ABCDE", 5)).toBe("ABCDE");
  });

  it("超過時はエラー", () => {
    expect(() => padRight("ABCDEF", 5)).toThrow(/5 桁を超えて/);
  });
});

describe("padLeftZero", () => {
  it("短い文字列は左側 0 埋め", () => {
    expect(padLeftZero("123", 5)).toBe("00123");
  });

  it("ちょうどの長さはそのまま", () => {
    expect(padLeftZero("12345", 5)).toBe("12345");
  });

  it("超過時はエラー", () => {
    expect(() => padLeftZero("123456", 5)).toThrow(/5 桁を超えて/);
  });
});
