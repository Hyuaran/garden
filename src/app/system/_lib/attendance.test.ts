import { describe, expect, it } from "vitest";
import { isPunchType, parseJstDate } from "./attendance";

describe("attendance helpers", () => {
  it("accepts only the four punch types", () => {
    for (const type of ["clock_in", "clock_out", "break_start", "break_end"]) expect(isPunchType(type)).toBe(true);
    expect(isPunchType("other")).toBe(false);
  });
  it("converts a JST day to an exclusive UTC range", () => {
    expect(parseJstDate("2026-08-13")).toEqual({
      date: "2026-08-13", from: "2026-08-12T15:00:00.000Z", to: "2026-08-13T15:00:00.000Z",
    });
  });
  it("rejects invalid calendar dates", () => expect(() => parseJstDate("2026-02-30")).toThrow());
});
