import { describe, expect, it } from "vitest";

import { sortExpenseReviewRows, type ExpenseReviewSortableRow } from "../expense-review-sort";

const rows: ExpenseReviewSortableRow[] = [
  { id: "b", receipt_date: "2026-07-02", amount: 3000, applicant_label: "Yamada", store_name: "Beta", effective_corp_id: "corp-b" },
  { id: "a", receipt_date: "2026-07-01", amount: 5000, applicant_label: "Sato", store_name: "Alpha", effective_corp_id: "corp-a" },
  { id: "c", receipt_date: "2026-07-01", amount: 5000, applicant_label: "Abe", store_name: "Gamma", effective_corp_id: "corp-c" },
];

describe("sortExpenseReviewRows", () => {
  it("keeps default order unchanged", () => {
    expect(sortExpenseReviewRows(rows, "default", "asc").map((row) => row.id)).toEqual(["b", "a", "c"]);
  });

  it("reverses default order when descending", () => {
    expect(sortExpenseReviewRows(rows, "default", "desc").map((row) => row.id)).toEqual(["c", "a", "b"]);
  });

  it("does not mutate the input array when reversing default order", () => {
    const input = [...rows];
    sortExpenseReviewRows(input, "default", "desc");
    expect(input.map((row) => row.id)).toEqual(["b", "a", "c"]);
  });

  it("sorts by amount descending with stable ties", () => {
    expect(sortExpenseReviewRows(rows, "amount", "desc").map((row) => row.id)).toEqual(["a", "c", "b"]);
  });

  it("sorts by applicant ascending", () => {
    expect(sortExpenseReviewRows(rows, "applicant", "asc").map((row) => row.id)).toEqual(["c", "a", "b"]);
  });
});
