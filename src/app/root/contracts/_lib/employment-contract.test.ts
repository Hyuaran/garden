import { describe, expect, it } from "vitest";
import {
  validateContract,
  type EmploymentContractPayload,
} from "./employment-contract";
const valid: EmploymentContractPayload = {
  kind: "new",
  contractStart: "2026-09-01",
  contractEnd: "2027-03-31",
  jobType: "sales",
  jobTypeOther: "",
  hourlyWage: 1200,
  workLocation: "大阪市",
  concludedOn: "2026-08-28",
  employeeAddress: "",
};
describe("employment contract validation", () => {
  it("accepts valid input", () =>
    expect(validateContract("E1", valid)).toBeNull());
  it.each([
    "contractStart",
    "contractEnd",
    "jobType",
    "workLocation",
    "concludedOn",
  ])("requires %s", (key) =>
    expect(validateContract("E1", { ...valid, [key]: "" })).toMatch(/必須/),
  );
  it("requires employee and other text", () => {
    expect(validateContract("", valid)).toMatch(/必須/);
    expect(
      validateContract("E1", { ...valid, jobType: "other", jobTypeOther: "" }),
    ).toMatch(/その他/);
  });
  it("validates wage and date order", () => {
    expect(validateContract("E1", { ...valid, hourlyWage: 0 })).toMatch(
      /正の整数/,
    );
    expect(
      validateContract("E1", { ...valid, contractEnd: valid.contractStart }),
    ).toMatch(/開始日より後/);
  });
});
