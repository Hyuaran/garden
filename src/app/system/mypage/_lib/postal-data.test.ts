import { describe, expect, it } from "vitest";
import { formatPostalDatasetDate, isPostalDatasetStale } from "./postal-data";

describe("postal dataset status", () => {
  it("formats the source date and warns after two months", () => {
    expect(formatPostalDatasetDate("2026-08-01")).toBe("2026年8月1日 時点");
    expect(isPostalDatasetStale("2026-08-01", new Date("2026-09-30T23:59:59Z"))).toBe(false);
    expect(isPostalDatasetStale("2026-08-01", new Date("2026-10-01T00:00:00Z"))).toBe(true);
  });
});
