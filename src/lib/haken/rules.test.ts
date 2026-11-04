import { describe, expect, it } from "vitest";
import {
  addMonths,
  canDeleteWorker,
  conflictDate,
  conflictMismatch,
  individualConflictDate,
} from "./rules";

describe("派遣の期限", () => {
  it("うるう年と月末を丸める", () => {
    expect(addMonths("2024-02-29", 36)).toBe("2027-02-28");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
  });
  it("３か月ちょうどの空きは続き、超えるとやり直す", () => {
    const first = { start: "2023-01-01", end: "2023-02-01" };
    expect(
      conflictDate([first, { start: "2023-05-01", end: null }], "2023-05-01"),
    ).toBe("2026-01-01");
    expect(
      conflictDate([first, { start: "2023-05-02", end: null }], "2023-05-02"),
    ).toBe("2026-05-02");
  });
  it("重複期間と終了日未定の契約を扱う", () => {
    expect(
      conflictDate(
        [
          { start: "2023-01-01", end: null },
          { start: "2024-01-01", end: "2024-01-31" },
          { start: "2025-01-01", end: null },
        ],
        "2025-01-01",
      ),
    ).toBe("2026-01-01");
  });
  it("無期・60歳以上の個人は対象外", () => {
    const periods = [{ start: "2026-09-11", end: null }];
    expect(
      individualConflictDate(periods, "2026-09-11", true, false),
    ).toBeNull();
    expect(
      individualConflictDate(periods, "2026-09-11", false, true),
    ).toBeNull();
  });
  it("通知日との差と保存期限を確認する", () => {
    expect(conflictMismatch("2029-09-11", "2029-09-12")).toBe(true);
    expect(conflictMismatch("2029-09-11", null)).toBe(false);
    expect(canDeleteWorker("2024-02-29", "2027-02-27")).toBe(false);
    expect(canDeleteWorker("2024-02-29", "2027-02-28")).toBe(true);
    expect(canDeleteWorker(null, "2026-11-04")).toBe(true);
  });
});
