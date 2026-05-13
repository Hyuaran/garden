/**
 * POST /api/forest/shiwakechou/upload-bk
 *
 * 銀行 CSV / .api ファイルを受け取り、parser でパースしてプレビュー結果を返す。
 * (B-min 最小実装: Supabase Storage への永続化 + bud_transactions INSERT は 5/13 以降の本番接続時)
 *
 * 入力:
 *   - multipart/form-data
 *     - bank_account_id: string (UUID, bud_bank_accounts.id)
 *     - file: Blob (CSV / .api)
 *
 * 出力:
 *   - 200 success: { rows: ParsedBankRow[], opening_balance, closing_balance, warnings }
 *   - 401/403/400/500
 *
 * 認証:
 *   - Authorization: Bearer <jwt>
 *   - forest_users.role IN ('admin','executive') - balance-overview と同方針
 *
 * 元 Python: 4_仕訳帳_弥生出力_v11.py の read_bank_file() に相当
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { parseRakutenCsv } from "@/lib/shiwakechou/parsers/bank/rakuten";
import {
  parseMizuhoApi,
  deriveMizuhoFilenamePeriod,
} from "@/lib/shiwakechou/parsers/bank/mizuho";
import { parsePayPayCsv } from "@/lib/shiwakechou/parsers/bank/paypay";
import { parseKyotoCsv } from "@/lib/shiwakechou/parsers/bank/kyoto";
import {
  BankParserError,
  type ParseResult,
  type ParsedBankRow,
} from "@/lib/shiwakechou/types";
import {
  classifyTransaction,
  type ClassifyInput,
  type MasterRule,
  type SelfAccount,
} from "@/lib/shiwakechou/classifier";
import { createHash } from "node:crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const ALLOWED_ROLES = ["admin", "executive"] as const;

export interface UploadBkResponse {
  success: boolean;
  error?: string;
  bank_kind?: string;
  filename?: string;
  file_size_bytes?: number;
  row_count?: number;
  opening_balance?: number | null;
  closing_balance?: number | null;
  warnings_count?: number;
  /** parser 結果の最初 10 行プレビュー (UI 表示用) */
  rows_preview?: Array<{
    transaction_date: string;
    amount: number;
    flow: string;
    description: string;
    balance_after: number | null;
  }>;
  /** Step 0 DB INSERT 結果 (dispatch # 351 追加対応) */
  insert?: {
    file_id: string;
    transactions_inserted: number;
    transactions_skipped_duplicate: number;
    /** 期間別件数 */
    by_month: Record<string, number>;
    /** classifier 適用後の status 別件数 */
    classifier_result: {
      ok: number;
      internal_transfer: number;
      pending: number;
      total: number;
      auto_classify_rate: number;
    };
    /** 期初残高 (B-min 残高検算用) */
    opening_balance_used: {
      source: "csv_first_row_back_calculation" | "manual_balance_20260430" | "none";
      value: number | null;
      note: string;
    };
  };
}

export async function POST(req: NextRequest) {
  // 1. 認証
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json<UploadBkResponse>(
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
    return NextResponse.json<UploadBkResponse>(
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
    return NextResponse.json<UploadBkResponse>(
      { success: false, error: `権限確認エラー: ${roleErr.message}` },
      { status: 500 },
    );
  }
  if (
    !forestUser ||
    !ALLOWED_ROLES.includes(forestUser.role as (typeof ALLOWED_ROLES)[number])
  ) {
    return NextResponse.json<UploadBkResponse>(
      { success: false, error: "admin / executive 権限が必要です" },
      { status: 403 },
    );
  }

  // 3. multipart parse
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (e) {
    return NextResponse.json<UploadBkResponse>(
      {
        success: false,
        error: `multipart パース失敗: ${e instanceof Error ? e.message : String(e)}`,
      },
      { status: 400 },
    );
  }

  const bankAccountId = formData.get("bank_account_id");
  const fileField = formData.get("file");
  if (typeof bankAccountId !== "string" || !bankAccountId) {
    return NextResponse.json<UploadBkResponse>(
      { success: false, error: "bank_account_id が指定されていません" },
      { status: 400 },
    );
  }
  if (!(fileField instanceof Blob)) {
    return NextResponse.json<UploadBkResponse>(
      { success: false, error: "file がアップロードされていません" },
      { status: 400 },
    );
  }
  const filename = (fileField as File).name ?? "unknown";

  // 4. 口座情報取得 (bank_kind 判定 + 期初残高選択用)
  const { data: account, error: accountErr } = await supabase
    .from("root_bank_accounts")
    .select("id, corp_code, bank_code, has_csv_export, manual_balance_20260430")
    .eq("id", bankAccountId)
    .maybeSingle();
  if (accountErr) {
    return NextResponse.json<UploadBkResponse>(
      { success: false, error: `口座マスタ取得失敗: ${accountErr.message}` },
      { status: 500 },
    );
  }
  if (!account) {
    return NextResponse.json<UploadBkResponse>(
      { success: false, error: `口座 ID ${bankAccountId} が見つかりません` },
      { status: 400 },
    );
  }
  if (!account.has_csv_export) {
    return NextResponse.json<UploadBkResponse>(
      {
        success: false,
        error:
          "この口座は CSV 出力対象外です (例: PayPay ヒュアラン システム障害)",
      },
      { status: 400 },
    );
  }

  // 5. ファイル → Buffer
  const arrayBuf = await fileField.arrayBuffer();
  const buf = Buffer.from(arrayBuf);

  // 6. bank_code (= bank_kind) 別パース
  let parseResult: ParseResult;
  try {
    switch (account.bank_code) {
      case "rakuten":
        parseResult = parseRakutenCsv(buf);
        break;
      case "mizuho": {
        const period = deriveMizuhoFilenamePeriod(filename);
        if (!period) {
          return NextResponse.json<UploadBkResponse>(
            {
              success: false,
              error: `みずほファイル名から期間を推論できません (期待: '...YYYYMMから YYYYMM(DD?)まで.api')`,
            },
            { status: 400 },
          );
        }
        parseResult = parseMizuhoApi(buf, { period });
        break;
      }
      case "paypay":
        parseResult = parsePayPayCsv(buf);
        break;
      case "kyoto":
        parseResult = parseKyotoCsv(buf);
        break;
      default:
        return NextResponse.json<UploadBkResponse>(
          {
            success: false,
            error: `未対応の bank_kind: ${account.bank_code}`,
          },
          { status: 400 },
        );
    }
  } catch (e) {
    if (e instanceof BankParserError) {
      return NextResponse.json<UploadBkResponse>(
        {
          success: false,
          error: `${account.bank_code} parser エラー: ${e.message}`,
          bank_kind: account.bank_code,
          filename,
        },
        { status: 400 },
      );
    }
    return NextResponse.json<UploadBkResponse>(
      {
        success: false,
        error: `parser 例外: ${e instanceof Error ? e.message : String(e)}`,
      },
      { status: 500 },
    );
  }

  // 7. Step 0: bud_files INSERT (アップロードファイルメタデータ、Storage 永続化は別途)
  const contentSha256 = createHash("sha256").update(buf).digest("hex");
  const { data: fileRow, error: fileErr } = await supabase
    .from("bud_files")
    .insert({
      corp_id: account.corp_code,
      bank_account_id: account.id,
      source_kind: "bk",
      bank_kind: account.bank_code,
      original_filename: filename,
      storage_path: `pending/${filename}`, // Storage 統合前のプレースホルダ
      file_size_bytes: buf.length,
      content_sha256: contentSha256,
      uploaded_by: user.id,
      processing_status: "parsed",
    })
    .select("id")
    .single();

  if (fileErr) {
    // 二重 import (UNIQUE 制約: corp_id + bank_account_id + content_sha256) は warning 扱いで継続
    if (fileErr.code !== "23505") {
      return NextResponse.json<UploadBkResponse>(
        { success: false, error: `bud_files INSERT 失敗: ${fileErr.message}` },
        { status: 500 },
      );
    }
  }
  const fileId = fileRow?.id ?? "duplicate";

  // 8. Step 0: bud_transactions bulk INSERT (status='pending' で投入)
  const txInserts = parseResult.rows.map((r) => ({
    corp_id: account.corp_code,
    bank_account_id: account.id,
    source_file_id: fileRow?.id ?? null,
    source_kind: "bk" as const,
    transaction_date: r.transaction_date,
    amount: r.amount,
    flow: r.flow,
    description: r.description,
    balance_after: r.balance_after,
    status: "pending" as const,
  }));

  let insertedCount = 0;
  let skippedDuplicate = 0;
  if (txInserts.length > 0) {
    // UNIQUE (bank_account_id, transaction_date, amount, flow, description) 衝突は skip
    const { data: insertedRows, error: txErr } = await supabase
      .from("bud_transactions")
      .upsert(txInserts, {
        onConflict: "bank_account_id,transaction_date,amount,flow,description",
        ignoreDuplicates: true,
      })
      .select("id");

    if (txErr) {
      return NextResponse.json<UploadBkResponse>(
        { success: false, error: `bud_transactions INSERT 失敗: ${txErr.message}` },
        { status: 500 },
      );
    }
    insertedCount = insertedRows?.length ?? 0;
    skippedDuplicate = txInserts.length - insertedCount;
  }

  // 9. Step 0.5: classifier 適用 (master_rules + self_accounts → UPDATE status/debit/credit/tax_class)
  const classifierResult = await applyClassifier(supabase, account, parseResult);

  // 10. 期間別件数集計
  const byMonth: Record<string, number> = {};
  for (const r of parseResult.rows) {
    const month = r.transaction_date.slice(0, 7); // YYYY-MM
    byMonth[month] = (byMonth[month] ?? 0) + 1;
  }

  // 11. 期初残高決定 (楽天: CSV 逆算 / みずほ: manual_balance_20260430)
  let openingBalanceUsed: NonNullable<UploadBkResponse["insert"]>["opening_balance_used"];
  if (
    parseResult.opening_balance !== null &&
    parseResult.opening_balance_derivation === "csv_first_row_back_calculation"
  ) {
    openingBalanceUsed = {
      source: "csv_first_row_back_calculation",
      value: parseResult.opening_balance,
      note: "parser が CSV 1 行目の balance_after - 1 行目入出金額 で逆算",
    };
  } else if (account.manual_balance_20260430 != null) {
    openingBalanceUsed = {
      source: "manual_balance_20260430",
      value: account.manual_balance_20260430,
      note: "みずほ .api は残高列なし、4/30 手入力残高を期初として使用 (整合性検証用)",
    };
  } else {
    openingBalanceUsed = {
      source: "none",
      value: null,
      note: "期初残高情報なし (CSV 逆算 + 手入力残高 ともに不在)",
    };
  }

  // 12. プレビュー応答
  return NextResponse.json<UploadBkResponse>({
    success: true,
    bank_kind: account.bank_code,
    filename,
    file_size_bytes: buf.length,
    row_count: parseResult.rows.length,
    opening_balance: parseResult.opening_balance,
    closing_balance: parseResult.closing_balance,
    warnings_count: parseResult.warnings.length,
    rows_preview: parseResult.rows.slice(0, 10).map((r) => ({
      transaction_date: r.transaction_date,
      amount: r.amount,
      flow: r.flow,
      description: r.description,
      balance_after: r.balance_after,
    })),
    insert: {
      file_id: fileId,
      transactions_inserted: insertedCount,
      transactions_skipped_duplicate: skippedDuplicate,
      by_month: byMonth,
      classifier_result: classifierResult,
      opening_balance_used: openingBalanceUsed,
    },
  });
}

// ----------------------------------------------------------------
// Step 0.5: classifier 適用 (master_rules + self_accounts → UPDATE)
// ----------------------------------------------------------------

interface AccountInfo {
  id: string;
  corp_code: string;
  bank_code: string;
  has_csv_export: boolean;
  manual_balance_20260430: number | null;
}

async function applyClassifier(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  account: AccountInfo,
  parseResult: ParseResult,
): Promise<NonNullable<UploadBkResponse["insert"]>["classifier_result"]> {
  // self_accounts: 同法人内の他口座 (自社内移し替え検出用)
  const { data: selfAcctsData } = await supabase
    .from("root_bank_accounts")
    .select("id, bank_code, account_number, sub_account_label")
    .eq("corp_code", account.corp_code)
    .eq("is_active", true)
    .is("deleted_at", null);

  const self_accounts: SelfAccount[] = (selfAcctsData ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((a: any) => a.id !== account.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((a: any) => ({
      account_number: a.account_number,
      bank_kind: a.bank_code,
      sub_account_label: a.sub_account_label ?? "",
    }));

  // 現アカウントの sub_account_label
  const { data: currentAcct } = await supabase
    .from("root_bank_accounts")
    .select("sub_account_label")
    .eq("id", account.id)
    .single();
  const current_account_sub_label: string =
    currentAcct?.sub_account_label ?? "";

  // master_rules (priority desc + is_active=true)
  const { data: rulesData } = await supabase
    .from("bud_master_rules")
    .select(
      "id, pattern, pattern_kind, direction, category, debit_account, credit_account, tax_class, is_intercompany, priority, is_active",
    )
    .eq("is_active", true)
    .order("priority", { ascending: false });

  const master_rules: MasterRule[] = (rulesData ?? []) as MasterRule[];

  // 今回 INSERT した取引のみを再 fetch (corp_id + bank_account_id + 期間)
  const dates = parseResult.rows.map((r) => r.transaction_date).sort();
  if (dates.length === 0) {
    return {
      ok: 0,
      internal_transfer: 0,
      pending: 0,
      total: 0,
      auto_classify_rate: 0,
    };
  }
  const from = dates[0];
  const to = dates[dates.length - 1];

  const { data: pendingTxs } = await supabase
    .from("bud_transactions")
    .select("id, transaction_date, amount, flow, description, status")
    .eq("corp_id", account.corp_code)
    .eq("bank_account_id", account.id)
    .eq("status", "pending")
    .gte("transaction_date", from)
    .lte("transaction_date", to);

  if (!pendingTxs || pendingTxs.length === 0) {
    return {
      ok: 0,
      internal_transfer: 0,
      pending: 0,
      total: 0,
      auto_classify_rate: 0,
    };
  }

  let okCount = 0;
  let internalTransferCount = 0;
  let pendingCount = 0;

  // 各 pending 取引に classifier 適用 → UPDATE
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const tx of pendingTxs as any[]) {
    const input: ClassifyInput = {
      transaction: {
        transaction_date: tx.transaction_date,
        amount: tx.amount,
        flow: tx.flow,
        description: tx.description,
      },
      current_account_sub_label,
      self_accounts,
      master_rules,
    };
    const classified = classifyTransaction(input);

    if (classified.status === "pending") {
      pendingCount++;
      continue; // pending のまま、UPDATE 不要
    }

    // status='ok' or 'internal_transfer' → UPDATE
    const { error: upErr } = await supabase
      .from("bud_transactions")
      .update({
        status: classified.status,
        applied_rule_id: classified.applied_rule_id,
        debit_account: classified.debit_account,
        credit_account: classified.credit_account,
        tax_class: classified.tax_class,
      })
      .eq("id", tx.id);

    if (upErr) {
      // 個別 update 失敗は warning 扱いで継続 (pending として残る)
      pendingCount++;
      continue;
    }

    if (classified.status === "ok") okCount++;
    else if (classified.status === "internal_transfer") internalTransferCount++;
  }

  const total = pendingTxs.length;
  const auto_classify_rate =
    total === 0 ? 0 : (okCount + internalTransferCount) / total;

  return {
    ok: okCount,
    internal_transfer: internalTransferCount,
    pending: pendingCount,
    total,
    auto_classify_rate,
  };
}

// 未使用 import を抑止するための再エクスポート (型のみ参照される場合の TypeScript 警告防止)
export type { ParsedBankRow };
