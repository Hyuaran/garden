import { describe, expect, it } from "vitest";

import { filterExpenseListRecords, sumExpenseAmounts } from "../expense-list-filter";
import type { SearchRecord } from "../filemaker-search";

const records: Array<SearchRecord & { amount: number | null }> = [
  {
    id: "pending-1",
    corp_id: "hyuaran",
    expense_kind: "会社経費",
    category_id: "交通費",
    qualified_class: "有",
    receipt_date: "2026-07-01",
    receipt_time: "09:00",
    amount: 1200,
    store_name: "Tokyo Station",
    qualified_number: "T1234567890123",
    description: "train",
    applicant_employee_id: "宮永",
  },
  {
    id: "done-1",
    corp_id: "arata",
    expense_kind: "個人経費",
    category_id: "会議費",
    qualified_class: "無",
    receipt_date: "2026-07-02",
    receipt_time: "13:00",
    amount: 3400,
    store_name: "Osaka Cafe",
    qualified_number: "",
    description: "meeting",
    applicant_employee_id: "東海林",
  },
];

describe("expense list filter", () => {
  it("searches all list rows across multiple fields", () => {
    expect(filterExpenseListRecords(records, "all", "Osaka").records.map((record) => record.id)).toEqual(["done-1"]);
    expect(filterExpenseListRecords(records, "all", "宮永").records.map((record) => record.id)).toEqual(["pending-1"]);
  });

  it("searches a specific field", () => {
    expect(filterExpenseListRecords(records, "expense_kind", "個人").records.map((record) => record.id)).toEqual(["done-1"]);
  });

  it("sums visible amounts", () => {
    expect(sumExpenseAmounts(records)).toBe(4600);
    expect(sumExpenseAmounts([records[0]])).toBe(1200);
  });
});
