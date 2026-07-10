export type ExpenseQueryError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

export function isMissingSoftDeleteColumnError(error: ExpenseQueryError | null | undefined) {
  if (!error) return false;
  if (error.code === "42703") return true;
  const text = [error.message, error.details, error.hint].filter(Boolean).join(" ").toLowerCase();
  return text.includes("deleted_at") || text.includes("deleted_by") || text.includes("delete_reason");
}
