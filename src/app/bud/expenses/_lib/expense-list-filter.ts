import { executeFileMakerSearch, hasSearchConditions, type SearchField, type SearchRecord, type SearchSheet } from "./filemaker-search";

export const LIST_SEARCH_FIELDS: SearchField[] = [
  "corp_id",
  "expense_kind",
  "category_id",
  "qualified_class",
  "receipt_date",
  "receipt_time",
  "amount",
  "store_name",
  "qualified_number",
  "description",
  "applicant_employee_id",
];

export function buildListSearchSheets(field: SearchField | "all", value: string): SearchSheet[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (field === "all") {
    return LIST_SEARCH_FIELDS.map((searchField) => ({ [searchField]: trimmed }));
  }
  return [{ [field]: trimmed }];
}

export function filterExpenseListRecords<T extends SearchRecord>(
  records: T[],
  field: SearchField | "all",
  value: string,
): { records: T[]; summary: string } {
  const sheets = buildListSearchSheets(field, value);
  if (!sheets.some((sheet) => hasSearchConditions(sheet))) return { records, summary: "" };
  const result = executeFileMakerSearch(records, sheets);
  return { records: result.records, summary: result.summary };
}

export function sumExpenseAmounts(rows: Array<{ amount: number | null }>) {
  return rows.reduce((sum, row) => sum + (row.amount ?? 0), 0);
}
