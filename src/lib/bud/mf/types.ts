export type MfAccount = {
  fiscal_start_date?: string | null;
  bank_name?: string; corp_code?: string; mf_account_id: string; name: string; kind: "bank" | "card";
  sub_account_label: string; sort_order: number; hidden: boolean;
  visible_employee_ids: string[]; book_sub_account_name: string;
  balance_mode: "auto" | "manual_check" | "anchor"; anchor_balance?: number | null; anchor_date?: string | null; balance_note: string;
  balance: number | null; unjournalized_count: number; fetched_at: string;
};
export type ConnectedAccount = { id: string | number; name: string; connected_sub_accounts?: { name: string }[] };
export type Transaction = { id: string | number; connected_account_id: string | number; date: string; content: string; value: number; side: "INCOME" | "EXPENSE"; journalizing_status: string };
export type TrialRow = { type: string; name?: string; values?: (number | string | null)[]; rows?: TrialRow[]; children?: TrialRow[] };
export type CardTransaction = { mf_transaction_id: string; mf_account_id: string; date: string; content: string; value: number; side: string; journalizing_status: string; fetched_at: string };
export type Employee = { employee_id: string; name: string | null };

export type AxisOrder = { axis: "corp" | "bank"; key: string; sort_order: number };
export type BalanceSnapshot = { mf_account_id: string; snapshot_date: string; balance: number; taken_at: string };
