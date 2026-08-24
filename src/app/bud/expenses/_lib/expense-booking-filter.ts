import { filterExpenseListRecords } from "./expense-list-filter";
import type { SearchField, SearchRecord } from "./filemaker-search";

export type ExpenseBookingSearchField = SearchField | "all";

export type ExpenseBookingFilterValue = {
  id: string;
  applicantName: string;
  receiptDate: string | null;
  bookingDate: string | null;
  bookingCorpName: string;
  fiscalPeriod: string | null;
  expenseKind: string;
  categoryName: string;
  storeName: string | null;
  amount: number | null;
};

export function filterExpenseBookingRows<T>(
  rows: T[],
  field: ExpenseBookingSearchField,
  value: string,
  searchValue: (row: T) => ExpenseBookingFilterValue,
) {
  const records: SearchRecord[] = rows.map((row) => {
    const item = searchValue(row);
    return {
      id: item.id,
      applicant_employee_id: item.applicantName,
      receipt_date: item.receiptDate,
      receipt_time: item.bookingDate,
      corp_id: item.bookingCorpName,
      qualified_class: item.fiscalPeriod,
      expense_kind: `${item.expenseKind} ${item.categoryName}`.trim(),
      store_name: item.storeName,
      amount: item.amount,
    };
  });
  const result = filterExpenseListRecords(records, field, value);
  const matchingIds = new Set(result.records.map((record) => record.id));
  return { rows: rows.filter((row) => matchingIds.has(searchValue(row).id)), summary: result.summary };
}
