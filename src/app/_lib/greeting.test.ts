import { describe, expect, it } from "vitest";
import { getGreeting } from "./greeting";

describe("getGreeting", () => {
  it.each([
    [5, "おはようございます"],
    [10, "こんにちは"],
    [17, "お疲れさまです"],
    [23, "お疲れさまです"],
    [3, "お疲れさまです"],
  ])("returns the Garden greeting at %i:00", (hour, expected) => {
    expect(getGreeting(new Date(2026, 7, 29, hour, 0, 0))).toBe(expected);
  });
});
