/**
 * GET /api/forest/shiwakechou/balance-overview
 *
 * 全法人 × 全口座の最新残高を集計して返す (Q4 後道さん向け前日残高画面)。
 *
 * 認証: Authorization: Bearer <jwt>
 * 権限: forest_users.role IN ('admin','executive')
 *
 * 残高ロジック (優先順位):
 *   1. bud_transactions.balance_after の最新値 (有効データあれば)
 *   2. bud_bank_accounts.manual_balance_20260430 (手入力残高)
 *   3. null (データ不足)
 *
 * レスポンス:
 *   200: { success: true, data: BalanceOverviewData }
 *   401/403/500: { success: false, error: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const ALLOWED_ROLES = ["admin", "executive"] as const;

interface CorpRow {
  id: string;
  code: string;
  name_full: string;
  name_short: string;
  sort_order: number;
}

interface AccountRow {
  id: string;
  corp_id: string;
  bank_kind: string;
  bank_name: string;
  account_number: string;
  sub_account_label: string;
  manual_balance_20260430: number | null;
  has_csv: boolean;
  notes: string | null;
}

interface LatestBalanceRow {
  bank_account_id: string;
  balance_after: number | null;
  transaction_date: string;
}

export interface BalanceOverviewData {
  generated_at: string;
  corps: CorpRow[];
  accounts: Array<
    AccountRow & {
      latest_balance: number | null;
      latest_balance_source: "transactions" | "manual" | "none";
      latest_balance_date: string | null;
    }
  >;
  totals: {
    total_balance: number;
    csv_count: number;
    manual_count: number;
    missing_count: number;
  };
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

  // ユーザー認証
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

  // ロール確認
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

  // 法人マスタ
  const { data: corpsData, error: corpsErr } = await supabase
    .from("bud_corporations")
    .select("id,code,name_full,name_short,sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (corpsErr) {
    return NextResponse.json(
      { success: false, error: `法人マスタ取得失敗: ${corpsErr.message}` },
      { status: 500 },
    );
  }

  // 口座マスタ
  const { data: accountsData, error: accountsErr } = await supabase
    .from("bud_bank_accounts")
    .select(
      "id,corp_id,bank_kind,bank_name,account_number,sub_account_label,manual_balance_20260430,has_csv,notes",
    )
    .eq("is_active", true);
  if (accountsErr) {
    return NextResponse.json(
      { success: false, error: `口座マスタ取得失敗: ${accountsErr.message}` },
      { status: 500 },
    );
  }

  // 各口座の最新 balance_after を取得 (口座ごとに 1 件ずつ)
  const latestBalances = new Map<string, LatestBalanceRow>();
  if (accountsData && accountsData.length > 0) {
    // 口座 ID 配列で IN クエリ → 全取引から各口座の最新行を抽出
    // (大量データの場合は SQL view や RPC で最適化推奨, B-min は 12 口座のみなので直列でも OK)
    for (const acct of accountsData as AccountRow[]) {
      const { data: txData, error: txErr } = await supabase
        .from("bud_transactions")
        .select("bank_account_id,balance_after,transaction_date")
        .eq("bank_account_id", acct.id)
        .not("balance_after", "is", null)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1);
      if (!txErr && txData && txData.length > 0) {
        latestBalances.set(acct.id, txData[0] as LatestBalanceRow);
      }
    }
  }

  // 集計
  const accountsWithBalance = (accountsData as AccountRow[]).map((acct) => {
    const latest = latestBalances.get(acct.id);
    let latest_balance: number | null = null;
    let latest_balance_source: "transactions" | "manual" | "none" = "none";
    let latest_balance_date: string | null = null;

    if (latest && latest.balance_after !== null) {
      latest_balance = latest.balance_after;
      latest_balance_source = "transactions";
      latest_balance_date = latest.transaction_date;
    } else if (acct.manual_balance_20260430 !== null) {
      latest_balance = acct.manual_balance_20260430;
      latest_balance_source = "manual";
      latest_balance_date = "2026-04-30";
    }

    return {
      ...acct,
      latest_balance,
      latest_balance_source,
      latest_balance_date,
    };
  });

  let total = 0;
  let csv_count = 0;
  let manual_count = 0;
  let missing_count = 0;
  for (const a of accountsWithBalance) {
    if (a.latest_balance !== null) total += a.latest_balance;
    if (a.latest_balance_source === "transactions") csv_count++;
    else if (a.latest_balance_source === "manual") manual_count++;
    else missing_count++;
  }

  const data: BalanceOverviewData = {
    generated_at: new Date().toISOString(),
    corps: (corpsData ?? []) as CorpRow[],
    accounts: accountsWithBalance,
    totals: {
      total_balance: total,
      csv_count,
      manual_count,
      missing_count,
    },
  };

  return NextResponse.json({ success: true, data });
}
