export type ExpenseReviewSortField = "default" | "receipt_date" | "amount" | "applicant" | "store_name" | "corp_id";
export type ExpenseReviewSortDirection = "asc" | "desc";

export type ExpenseReviewSortableRow = {
  id: string;
  receipt_date: string | null;
  amount: number | null;
  applicant_label: string;
  store_name: string | null;
  effective_corp_id: string | null;
};

function normalizeValue(row: ExpenseReviewSortableRow, field: ExpenseReviewSortField) {
  if (field === "receipt_date") return row.receipt_date ?? "";
  if (field === "amount") return row.amount ?? Number.NEGATIVE_INFINITY;
  if (field === "applicant") return row.applicant_label;
  if (field === "store_name") return row.store_name ?? "";
  if (field === "corp_id") return row.effective_corp_id ?? "";
  return "";
}

export function sortExpenseReviewRows<T extends ExpenseReviewSortableRow>(
  rows: T[],
  field: ExpenseReviewSortField,
  direction: ExpenseReviewSortDirection,
): T[] {
  // 「送り順」(default) は元の並び。降順を選んだときは元の並びを逆にする。
  if (field === "default") return direction === "asc" ? rows : [...rows].reverse();
  const multiplier = direction === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const leftValue = normalizeValue(left.row, field);
      const rightValue = normalizeValue(right.row, field);
      const result =
        typeof leftValue === "number" && typeof rightValue === "number"
          ? leftValue - rightValue
          : String(leftValue).localeCompare(String(rightValue), "ja-JP", { numeric: true });
      if (result !== 0) return result * multiplier;
      return left.index - right.index;
    })
    .map((item) => item.row);
}
