import { describe, expect, it } from "vitest";

import { filterExpenseBookingRows, type ExpenseBookingFilterValue } from "./expense-booking-filter";
import { buildFinalApplicantOptions, filterFinalRowsByApplicant } from "./expense-final-applicant-filter";
import { groupExpenseBookingRows, summarizeExpenseBookingSelection } from "./expense-booking-groups";

const rows: ExpenseBookingFilterValue[] = [
  { id: "a", applicantName: "山田 太郎", receiptDate: "2026-08-01", bookingDate: "2026-08-24", bookingCorpName: "ヒュアラン", fiscalPeriod: "第12期", expenseKind: "個人経費", categoryName: "旅費交通費", storeName: "東京駅", amount: 1200 },
  { id: "b", applicantName: "取込 花子", receiptDate: "2026-08-02", bookingDate: "2026-08-25", bookingCorpName: "ガーデン", fiscalPeriod: "第3期", expenseKind: "会社経費", categoryName: "会議費", storeName: "喫茶店", amount: 3300 },
];
const searchValue = (row: ExpenseBookingFilterValue) => row;

describe("expense booking search", () => {
  it("finds applicant names in all-fields and applicant searches", () => {
    expect(filterExpenseBookingRows(rows, "all", "取込 花子", searchValue).rows.map((row) => row.id)).toEqual(["b"]);
    expect(filterExpenseBookingRows(rows, "applicant_employee_id", "山田", searchValue).rows.map((row) => row.id)).toEqual(["a"]);
  });

  it("searches booking date, corporation, fiscal period and expense category", () => {
    expect(filterExpenseBookingRows(rows, "receipt_time", "2026-08-25", searchValue).rows.map((row) => row.id)).toEqual(["b"]);
    expect(filterExpenseBookingRows(rows, "corp_id", "ヒュアラン", searchValue).rows.map((row) => row.id)).toEqual(["a"]);
    expect(filterExpenseBookingRows(rows, "qualified_class", "第3期", searchValue).rows.map((row) => row.id)).toEqual(["b"]);
    expect(filterExpenseBookingRows(rows, "expense_kind", "会議費", searchValue).rows.map((row) => row.id)).toEqual(["b"]);
  });

  it("keeps imported applicants in options and limits selection and group totals to filtered rows", () => {
    expect(buildFinalApplicantOptions(rows, (row) => row.applicantName)).toEqual(["山田 太郎", "取込 花子"]);
    const filtered = filterFinalRowsByApplicant(rows, "取込 花子", (row) => row.applicantName);
    const groupRows = filtered.map((row) => ({ ...row, applicantKey: row.applicantName, receiptDate: row.receiptDate, amount: row.amount ?? 0, selectable: true }));
    const selectedIds = new Set(groupRows.map((row) => row.id));
    expect(summarizeExpenseBookingSelection(groupRows, selectedIds)).toMatchObject({ totalCount: 1, totalAmount: 3300, selectedCount: 1, selectedAmount: 3300 });
    expect(groupExpenseBookingRows(groupRows)[0]).toMatchObject({ applicantName: "取込 花子", count: 1, totalAmount: 3300, selectableIds: ["b"] });
  });
});
