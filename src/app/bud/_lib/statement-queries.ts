import { supabase } from "./supabase";
import type {
  MatchableTransfer,
} from "./statement-matcher";

export interface BudStatementRow {
  id: string;
  bank_account_id: string;
  transaction_date: string;
  transaction_time: string | null;
  amount: number;
  balance_after: number | null;
  description: string;
  transaction_type: string | null;
  memo: string | null;
  matched_transfer_id: string | null;
  matched_at: string | null;
  matched_by: string | null;
  match_confidence: "exact" | "high" | "manual" | null;
  category: string | null;
  subcategory: string | null;
  cc_meisai_id: string | null;
  source_type: "rakuten_csv" | "mizuho_csv" | "paypay_csv" | "manual";
  imported_batch_id: string | null;
  raw_row: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface BudStatementImportBatchRow {
  id: string;
  bank_account_id: string;
  source_type: "rakuten_csv" | "mizuho_csv" | "paypay_csv" | "manual";
  file_name: string;
  file_storage_path: string | null;
  row_count: number;
  success_count: number;
  error_count: number;
  skipped_count: number;
  auto_matched_count: number;
  imported_at: string;
  imported_by: string;
  status: "completed" | "partial" | "failed";
  error_summary: string | null;
}

export interface StatementListFilter {
  bankAccountId?: string;
  fromDate?: string;
  toDate?: string;
  matchedOnly?: boolean;
  unmatchedOnly?: boolean;
  limit?: number;
}

export async function fetchStatementList(
  filter: StatementListFilter = {},
): Promise<BudStatementRow[]> {
  let q = supabase.from("bud_statements").select("*");

  if (filter.bankAccountId) {
    q = q.eq("bank_account_id", filter.bankAccountId);
  }
  if (filter.fromDate) {
    q = q.gte("transaction_date", filter.fromDate);
  }
  if (filter.toDate) {
    q = q.lte("transaction_date", filter.toDate);
  }
  if (filter.matchedOnly) {
    q = q.not("matched_transfer_id", "is", null);
  }
  if (filter.unmatchedOnly) {
    q = q.is("matched_transfer_id", null);
  }
  q = q.order("transaction_date", { ascending: false }).limit(filter.limit ?? 200);

  const { data, error } = await q;
  if (error) throw new Error(`明細取得に失敗: ${error.message}`);
  return (data ?? []) as BudStatementRow[];
}

export async function fetchMatchableTransfers(): Promise<MatchableTransfer[]> {
  const { data, error } = await supabase
    .from("bud_transfers")
    .select(
      "transfer_id, amount, scheduled_date, payee_name, status, executed_date",
    )
    .in("status", ["承認済み", "CSV出力済み"])
    .is("executed_date", null)
    .limit(500);

  if (error) throw new Error(`照合候補取得に失敗: ${error.message}`);
  return (data ?? []) as MatchableTransfer[];
}

export async function fetchImportBatches(
  bankAccountId?: string,
): Promise<BudStatementImportBatchRow[]> {
  let q = supabase.from("bud_statement_import_batches").select("*");
  if (bankAccountId) q = q.eq("bank_account_id", bankAccountId);
  q = q.order("imported_at", { ascending: false }).limit(50);
  const { data, error } = await q;
  if (error) throw new Error(`取込履歴取得に失敗: ${error.message}`);
  return (data ?? []) as BudStatementImportBatchRow[];
}
