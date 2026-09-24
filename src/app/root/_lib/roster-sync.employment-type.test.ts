import { describe, expect, it } from "vitest";
import { normalizeEmploymentType } from "./roster-sync.server";

// 名簿の「雇用形態」を Root の 4 区分（正社員／アルバイト／outsource／役員）にそろえる
describe("normalizeEmploymentType", () => {
  it("maps the roster values to the four Root kinds", () => {
    expect(normalizeEmploymentType("正社員")).toBe("正社員");
    expect(normalizeEmploymentType("アルバイト")).toBe("アルバイト");
    expect(normalizeEmploymentType("パート")).toBe("アルバイト");
    expect(normalizeEmploymentType("役員")).toBe("役員");
    expect(normalizeEmploymentType("業務委託")).toBe("outsource");
  });

  // 名簿の選択肢に「業務委託／外注」は無く、外注の人は「パートナー」で登録する（2026-09-24）
  it("treats パートナー as outsource", () => {
    expect(normalizeEmploymentType("パートナー")).toBe("outsource");
  });

  it("falls back to 正社員 when the value is empty or unknown", () => {
    expect(normalizeEmploymentType("")).toBe("正社員");
    expect(normalizeEmploymentType(null)).toBe("正社員");
    expect(normalizeEmploymentType("準社員")).toBe("正社員");
  });
});
