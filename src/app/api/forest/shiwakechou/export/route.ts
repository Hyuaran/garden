/**
 * GET /api/forest/shiwakechou/export
 *
 * 仕訳帳 弥生 CSV エクスポート (Forest 仕訳帳機能、dispatch # 351 ヒュアラン決算救援)
 *
 * 認証: Authorization: Bearer <jwt>
 * 権限: forest_users.role IN ('admin','executive')
 *
 * クエリパラメータ:
 *   - corp_id: string (必須、bud_corporations.id, 例 'hyuaran')
 *   - month: YYYY-MM (optional, default '2026-04', Day-1 は 4 月固定)
 *
 * レスポンス:
 *   - 200: text/csv; charset=Shift_JIS、Content-Disposition: attachment
 *     body: 弥生インポート CSV bytes (Shift-JIS + CRLF, BOM なし)
 *   - 401/403/400/500: JSON エラー
 *
 * 設計原則 (dispatch # 351 §2 絶対遵守):
 *   - 既存 lib (yayoi-csv-exporter / classifier / parsers) 一切編集禁止
 *   - 上から呼ぶだけ (import + 組み立てのみ)
 *   - Bud 移植 (src/app/bud/shiwakechou/*) は 5/17 以降、本日触らない
 *
 * 入力ソース: bud_transactions WHERE corp_id=$1 AND status='ok' AND 期間内
 *   - status='ok': classifier で仕訳化済 (debit_account / credit_account / tax_class セット)
 *   - status='pending' は UI で手動補完想定、本 export では除外
 *   - status='internal_transfer' も含める (自社内移し替えは弥生に出力対象)
 *
 * 元 Python: 5_仕訳帳_弥生変換_v7.py の出力形式に完全準拠 (shared lib 経由)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  exportYayoiCsv,
  type YayoiExportRow,
} from "@/shared/_lib/bank-csv-parsers/yayoi-csv-exporter";

export const runtime = "nodejs";
export const maxDuration = 60;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const ALLOWED_ROLES = ["admin", "executive"] as const;

// 弥生 export 対象 status (確認済 + 自社内移し替え)
const EXPORT_STATUSES = ["ok", "internal_transfer"] as const;

export async function GET(req: NextRequest) {
  // 1. 認証
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

  // 2. 権限
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

  // 3. クエリパラメータ
  const url = new URL(req.url);
  const corpId = url.searchParams.get("corp_id");
  const month = url.searchParams.get("month") ?? "2026-04";

  if (!corpId) {
    return NextResponse.json(
      { success: false, error: "corp_id が必須です" },
      { status: 400 },
    );
  }
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { success: false, error: `month が YYYY-MM 形式ではありません: ${month}` },
      { status: 400 },
    );
  }

  // 期間範囲計算 (YYYY-MM-01 〜 翌月 1 日の前日)
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const mo = Number(monthStr);
  const from = `${yearStr}-${monthStr}-01`;
  const nextMonth = new Date(year, mo, 0); // mo - 1 + 1 = 月末日
  const lastDay = nextMonth.getDate();
  const to = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

  // 4. 取引取得 (status='ok' + 'internal_transfer' = export 対象)
  const { data: txData, error: txErr } = await supabase
    .from("bud_transactions")
    .select(
      `id, transaction_date, amount, flow, description, status,
       debit_account, credit_account, tax_class,
       root_bank_accounts!inner(sub_account_label)`,
    )
    .eq("corp_id", corpId)
    .in("status", EXPORT_STATUSES as unknown as string[])
    .gte("transaction_date", from)
    .lte("transaction_date", to)
    .order("transaction_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (txErr) {
    return NextResponse.json(
      { success: false, error: `取引取得失敗: ${txErr.message}` },
      { status: 500 },
    );
  }

  if (!txData || txData.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: `${corpId} の ${month} に export 可能な取引 (status='ok' or 'internal_transfer') がありません`,
      },
      { status: 400 },
    );
  }

  // 5. YayoiExportRow へマッピング
  // bud_transactions の (debit_account / credit_account / tax_class) はすでに classifier で
  // セット済 (status='ok' or 'internal_transfer' の前提)。
  // sub_account_label は JOIN した root_bank_accounts から取得 (口座を補助科目として使う)。
  // amount + flow から借方/貸方の金額を導出:
  //   - flow='withdrawal' (出金): credit=口座 (普通預金), debit=master.debit
  //   - flow='deposit'    (入金): debit=口座 (普通預金), credit=master.credit
  // classifier はこの方針で UPDATE 済の前提、export 側はそのまま使用。
  const rows: YayoiExportRow[] = (txData as unknown as Array<{
    id: string;
    transaction_date: string;
    amount: number;
    flow: "withdrawal" | "deposit";
    description: string;
    status: string;
    debit_account: string | null;
    credit_account: string | null;
    tax_class: string | null;
    root_bank_accounts: { sub_account_label: string | null } | null;
  }>).map((r, i) => {
    const subLabel = r.root_bank_accounts?.sub_account_label ?? "";
    // "普通預金" 側の補助科目は口座、それ以外は空
    const isDeposit = r.flow === "deposit";
    const debit_sub =
      r.debit_account === "普通預金"
        ? isDeposit
          ? subLabel
          : "" // withdrawal で借方が普通預金になることは通常なし (相殺仕訳のみ)
        : "";
    const credit_sub =
      r.credit_account === "普通預金"
        ? isDeposit
          ? "" // deposit で貸方が普通預金になることは通常なし
          : subLabel
        : "";

    return {
      denpyo_no: i + 1,
      transaction_date: r.transaction_date,
      debit_account: r.debit_account ?? "",
      debit_sub_account: debit_sub,
      debit_tax_class: r.tax_class ?? "",
      debit_amount: r.amount,
      debit_tax_amount: 0, // 内税計算は弥生側で実施、export は概算 0 で出力
      credit_account: r.credit_account ?? "",
      credit_sub_account: credit_sub,
      credit_tax_class: r.tax_class ?? "",
      credit_amount: r.amount,
      credit_tax_amount: 0,
      description: r.description,
    };
  });

  // 6. shared lib で 弥生 CSV bytes 生成 (Shift-JIS + CRLF, BOM なし)
  const csvBuffer = exportYayoiCsv(rows);

  // 7. response (text/csv, Shift-JIS, attachment)
  const filename = `${corpId}_${month}_弥生.csv`;
  return new NextResponse(new Uint8Array(csvBuffer), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=Shift_JIS",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "X-Forest-Export-Rows": String(rows.length),
      "X-Forest-Export-Period": `${from}/${to}`,
    },
  });
}
