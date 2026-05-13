/**
 * GET /api/forest/shiwakechou/transactions
 *
 * 法人 + 期間で bud_transactions を取得 (status 別、確認画面用)。
 *
 * 認証: Authorization: Bearer <jwt>
 * 権限: forest_users.role IN ('admin','executive')
 *
 * クエリパラメータ:
 *   - corp_id: string (必須、bud_corporations.id)
 *   - from: YYYY-MM-DD (optional, default = "2026-04-01")
 *   - to: YYYY-MM-DD (optional, default = "2026-04-30")
 *   - status: TransactionStatus (optional, 未指定なら全 status)
 *
 * レスポンス: { success: true, data: TransactionListData }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const ALLOWED_ROLES = ["admin", "executive"] as const;

export interface TransactionListRow {
  id: string;
  bank_account_id: string | null;
  transaction_date: string;
  amount: number;
  flow: "withdrawal" | "deposit";
  description: string;
  balance_after: number | null;
  status: string;
  debit_account: string | null;
  credit_account: string | null;
  tax_class: string | null;
  applied_rule_id: string | null;
  bank_kind: string | null;
  account_number: string | null;
  sub_account_label: string | null;
}

export interface TransactionListData {
  corp_id: string;
  period_from: string;
  period_to: string;
  total_count: number;
  status_summary: Record<string, number>;
  rows: TransactionListRow[];
  /** 整合性検証: 期初残高 + 純流入 = 期末残高 のチェック */
  consistency_check: {
    bank_account_id: string;
    bank_kind: string;
    account_number: string;
    opening_balance: number | null;
    transaction_count: number;
    deposit_sum: number;
    withdrawal_sum: number;
    derived_closing_balance: number | null;
    actual_closing_balance: number | null;
    matched: boolean;
  }[];
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { success: false, error: "未認証です" },
      { status: 401 },
    );
  }
  const token = authHeader.slice(7);
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser(token);
  if (userErr || !user) {
    return NextResponse.json(
      { success: false, error: "認証に失敗しました" },
      { status: 401 },
    );
  }

  const { data: forestUser, error: roleErr } = await supabase
    .from("forest_users")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (roleErr) {
    return NextResponse.json(
      { success: false, error: `権限確認エラー: ${roleErr.message}` },
      { status: 500 },
    );
  }
  if (
    !forestUser ||
    !ALLOWED_ROLES.includes(forestUser.role as (typeof ALLOWED_ROLES)[number])
  ) {
    return NextResponse.json(
      { success: false, error: "admin / executive 権限が必要です" },
      { status: 403 },
    );
  }

  // クエリパラメータ
  const url = new URL(req.url);
  const corpId = url.searchParams.get("corp_id");
  const from = url.searchParams.get("from") ?? "2026-04-01";
  const to = url.searchParams.get("to") ?? "2026-04-30";
  const statusFilter = url.searchParams.get("status");

  if (!corpId) {
    return NextResponse.json(
      { success: false, error: "corp_id が必須です" },
      { status: 400 },
    );
  }

  // 取引取得 (status filter 適用)
  let query = supabase
    .from("bud_transactions")
    .select(
      `
      id, bank_account_id, transaction_date, amount, flow, description,
      balance_after, status, debit_account, credit_account, tax_class, applied_rule_id,
      root_bank_accounts!inner(bank_code, account_number, sub_account_label)
    `,
    )
    .eq("corp_id", corpId)
    .gte("transaction_date", from)
    .lte("transaction_date", to)
    .order("transaction_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data: txData, error: txErr } = await query;
  if (txErr) {
    return NextResponse.json(
      { success: false, error: `取引取得失敗: ${txErr.message}` },
      { status: 500 },
    );
  }

  // 整形
  const rows: TransactionListRow[] = (txData ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => ({
      id: r.id,
      bank_account_id: r.bank_account_id,
      transaction_date: r.transaction_date,
      amount: r.amount,
      flow: r.flow,
      description: r.description,
      balance_after: r.balance_after,
      status: r.status,
      debit_account: r.debit_account,
      credit_account: r.credit_account,
      tax_class: r.tax_class,
      applied_rule_id: r.applied_rule_id,
      bank_kind: r.root_bank_accounts?.bank_code ?? null,
      account_number: r.root_bank_accounts?.account_number ?? null,
      sub_account_label: r.root_bank_accounts?.sub_account_label ?? null,
    }),
  );

  // status サマリ
  const status_summary: Record<string, number> = {};
  for (const r of rows) {
    status_summary[r.status] = (status_summary[r.status] ?? 0) + 1;
  }

  // 整合性検証: 口座ごとに 期初 + 純流入 = 期末 が一致するか
  const consistency_check = await runConsistencyCheck(supabase, corpId, from, to);

  return NextResponse.json({
    success: true,
    data: {
      corp_id: corpId,
      period_from: from,
      period_to: to,
      total_count: rows.length,
      status_summary,
      rows,
      consistency_check,
    } satisfies TransactionListData,
  });
}

// ----------------------------------------------------------------
// 整合性検証
// ----------------------------------------------------------------

async function runConsistencyCheck(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  corpId: string,
  from: string,
  to: string,
): Promise<TransactionListData["consistency_check"]> {
  // 当該法人の口座一覧 (root_bank_accounts, B-min は corp_code でフィルタ)
  const { data: accts } = await supabase
    .from("root_bank_accounts")
    .select("id, bank_code, account_number, manual_balance_20260430, has_csv_export")
    .eq("corp_code", corpId)
    .eq("is_active", true)
    .is("deleted_at", null);

  if (!accts) return [];

  const checks: TransactionListData["consistency_check"] = [];

  for (const acct of accts) {
    if (!acct.has_csv_export) continue; // CSV 無し口座は検証対象外

    // 期間内の取引集計
    const { data: txs } = await supabase
      .from("bud_transactions")
      .select("amount, flow, balance_after")
      .eq("bank_account_id", acct.id)
      .gte("transaction_date", from)
      .lte("transaction_date", to)
      .order("transaction_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (!txs || txs.length === 0) {
      checks.push({
        bank_account_id: acct.id,
        bank_kind: acct.bank_code,
        account_number: acct.account_number,
        opening_balance: null,
        transaction_count: 0,
        deposit_sum: 0,
        withdrawal_sum: 0,
        derived_closing_balance: null,
        actual_closing_balance: null,
        matched: true, // データなしは matched 扱い
      });
      continue;
    }

    let deposit_sum = 0;
    let withdrawal_sum = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const t of txs as any[]) {
      if (t.flow === "deposit") deposit_sum += t.amount;
      else withdrawal_sum += t.amount;
    }

    // 期初残高 = 最初の取引 balance_after - 最初の取引純額 で逆算 (parser 同じロジック)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const first = txs[0] as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const last = txs[txs.length - 1] as any;
    const firstSigned = first.flow === "deposit" ? first.amount : -first.amount;
    const opening_balance =
      first.balance_after !== null ? first.balance_after - firstSigned : null;
    const actual_closing_balance = last.balance_after ?? null;
    const derived_closing_balance =
      opening_balance !== null
        ? opening_balance + deposit_sum - withdrawal_sum
        : null;
    const matched =
      derived_closing_balance !== null &&
      actual_closing_balance !== null &&
      derived_closing_balance === actual_closing_balance;

    checks.push({
      bank_account_id: acct.id,
      bank_kind: acct.bank_code,
      account_number: acct.account_number,
      opening_balance,
      transaction_count: txs.length,
      deposit_sum,
      withdrawal_sum,
      derived_closing_balance,
      actual_closing_balance,
      matched,
    });
  }

  return checks;
}
