export type ExpenseSoftDeleteRole = "super_admin" | "admin" | "manager" | "staff" | string | null | undefined;

export type ExpenseSoftDeleteRow = {
  id: string;
  status?: string | null;
};

export function canManageExpenseSoftDelete(role: ExpenseSoftDeleteRole) {
  return role === "super_admin";
}

export function normalizeDeleteReason(value: string | null | undefined) {
  const normalized = (value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

export function containsJournalizedExpense(rows: ExpenseSoftDeleteRow[]) {
  return rows.some((row) => row.status === "journalized");
}

export function buildExpenseDeleteConfirmMessage(rows: ExpenseSoftDeleteRow[], reason: string) {
  const warning = containsJournalizedExpense(rows)
    ? "\n\n仕訳済みレコードが含まれています。関連する仕訳・出力済みCSVの確認が必要です。"
    : "";
  return `${rows.length}件の経費申請を削除済みに移動します。\n\n理由: ${reason}${warning}\n\n実行しますか？`;
}
