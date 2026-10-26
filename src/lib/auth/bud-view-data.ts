// 読み取り API の対象を限定する。任意テーブル・RPC・埋め込み JOIN は許可しない。
export const BUD_READ_TABLES: Record<string, readonly string[]> = {
  "bud-expenses": ["bud_expense_requests", "bud_expense_categories", "bud_corporations", "root_companies", "root_employees"],
  "bud-transfers": ["bud_transfers", "bud_transfer_status_history", "root_bank_accounts", "root_companies", "root_vendors"],
  "bud-statements": ["bud_statements", "bud_statement_import_batches", "bud_transfers", "root_bank_accounts", "root_companies"],
};
export function validBudRead(page: string, table: string, params: URLSearchParams) {
  if (!BUD_READ_TABLES[page]?.includes(table)) return false;
  if (new Set(params.keys()).size !== [...params.keys()].length || params.has("and")) return false;
  const select = params.get("select") ?? "*";
  if (!/^[\w*,\s]+$/.test(select)) return false;
  if (page === "bud-statements" && table === "bud_transfers" && !select.split(",").every(column => ["transfer_id", "amount", "scheduled_date", "payee_name", "status", "executed_date"].includes(column.trim()))) return false;
  if ([...params.keys()].some(key => !/^[\w.]+$/.test(key) || ["columns", "on_conflict"].includes(key))) return false;
  if (table === "root_employees") {
    const columns = new Set(["employee_id", "company_id", "name", "user_id", "expense_default_corp_id"]);
    if (!select.split(",").every(column => columns.has(column.trim()))) return false;
    if (!["employee_id", "user_id"].some(key => /^(eq\.|in\.)/.test(params.get(key) ?? ""))) return false;
  }
  return true;
}
