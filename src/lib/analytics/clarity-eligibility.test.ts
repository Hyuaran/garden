import { describe, expect, it } from "vitest";
import { isClarityEligible } from "./clarity-eligibility";

describe("isClarityEligible", () => {
  it("18 歳の誕生日から記録してよい", () => {
    expect(isClarityEligible("2008-10-26", "2026-10-26")).toBe(true);
    expect(isClarityEligible("2008-10-27", "2026-10-26")).toBe(false);
  });
  it("大人は記録してよい", () => {
    expect(isClarityEligible("1990-01-01", "2026-10-26")).toBe(true);
  });
  it("生年月日が無い・形が違うときは記録しない", () => {
    expect(isClarityEligible(null, "2026-10-26")).toBe(false);
    expect(isClarityEligible("", "2026-10-26")).toBe(false);
    expect(isClarityEligible("1990/01/01", "2026-10-26")).toBe(false);
  });
});
