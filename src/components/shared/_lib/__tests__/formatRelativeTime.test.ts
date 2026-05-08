import { describe, it, expect } from "vitest";
import { formatRelativeTime, isStale } from "../formatRelativeTime";

describe("formatRelativeTime", () => {
  const now = new Date("2026-04-26T10:00:00Z");

  it("returns '今' for < 1 min", () => {
    expect(formatRelativeTime("2026-04-26T09:59:30Z", now)).toBe("今");
  });
  it("returns 'N 分前' for < 1 hour", () => {
    expect(formatRelativeTime("2026-04-26T09:55:00Z", now)).toBe("5 分前");
  });
  it("returns 'N 時間前' for < 1 day", () => {
    expect(formatRelativeTime("2026-04-26T07:00:00Z", now)).toBe("3 時間前");
  });
  it("returns 'N 日前' for >= 1 day", () => {
    expect(formatRelativeTime("2026-04-25T10:00:00Z", now)).toBe("1 日前");
  });
  it("returns '不明' for null", () => {
    expect(formatRelativeTime(null, now)).toBe("不明");
  });
});

describe("isStale", () => {
  const now = new Date("2026-04-26T10:00:00Z");
  it("returns false for < 30 min old", () => {
    expect(isStale("2026-04-26T09:35:00Z", now)).toBe(false);
  });
  it("returns true for >= 30 min old", () => {
    expect(isStale("2026-04-26T09:25:00Z", now)).toBe(true);
  });
  it("returns true for null (unknown is stale)", () => {
    expect(isStale(null, now)).toBe(true);
  });
});
