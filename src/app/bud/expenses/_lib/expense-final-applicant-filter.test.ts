import { describe, expect, it } from "vitest";

import { buildFinalApplicantOptions, filterFinalRowsByApplicant } from "./expense-final-applicant-filter";

type Row = { id: string; applicant: string };
const rows: Row[] = [
  { id: "employee-1", applicant: "山田 太郎" },
  { id: "imported-1", applicant: "取込 花子" },
  { id: "imported-2", applicant: "取込 花子" },
];

describe("final applicant filter", () => {
  it("builds unique options from applicants present in the current list", () => {
    expect(buildFinalApplicantOptions(rows, (row) => row.applicant)).toEqual(["山田 太郎", "取込 花子"]);
  });

  it("includes imported-name rows in the filtered list and therefore bulk targets", () => {
    expect(filterFinalRowsByApplicant(rows, "取込 花子", (row) => row.applicant).map((row) => row.id)).toEqual([
      "imported-1",
      "imported-2",
    ]);
  });

  it("returns all current rows for the default filter", () => {
    expect(filterFinalRowsByApplicant(rows, "all", (row) => row.applicant)).toBe(rows);
  });
});
