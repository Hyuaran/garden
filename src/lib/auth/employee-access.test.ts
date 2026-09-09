import { describe, expect, it } from "vitest";
import { isEmployeeActive, isRetiredByDate, shouldEmployeeBeActive } from "./employee-access";

describe("employee access", () => {
  it("requires is_active and no past/current termination date", () => {
    expect(isEmployeeActive({ is_active: true, termination_date: null }, "2026-09-09")).toBe(true);
    expect(isEmployeeActive({ is_active: true, termination_date: "2026-09-10" }, "2026-09-09")).toBe(true);
    expect(isEmployeeActive({ is_active: true, termination_date: "2026-09-09" }, "2026-09-09")).toBe(false);
    expect(isEmployeeActive({ is_active: false, termination_date: null }, "2026-09-09")).toBe(false);
    expect(isEmployeeActive({ is_active: true, deleted_at: "2026-09-09T00:00:00Z" }, "2026-09-09")).toBe(false);
  });

  it("maps roster status and retirement date to active", () => {
    expect(shouldEmployeeBeActive("在籍中", null, "2026-09-09")).toBe(true);
    expect(shouldEmployeeBeActive("在籍中", "2026-09-10", "2026-09-09")).toBe(true);
    expect(shouldEmployeeBeActive("在籍中", "2026-09-09", "2026-09-09")).toBe(false);
    expect(shouldEmployeeBeActive("退職済み", null, "2026-09-09")).toBe(false);
  });

  it("treats today as retired", () => {
    expect(isRetiredByDate("2026-09-09", "2026-09-09")).toBe(true);
    expect(isRetiredByDate("2026-09-10", "2026-09-09")).toBe(false);
  });
});
