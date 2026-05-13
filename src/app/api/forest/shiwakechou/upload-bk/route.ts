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
import { BankParserError, type ParseResult } from "@/lib/shiwakechou/types";

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

  // 4. 口座情報取得 (bank_kind 判定用)
  const { data: account, error: accountErr } = await supabase
    .from("root_bank_accounts")
    .select("id, corp_code, bank_code, has_csv_export")
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

  // 7. プレビュー応答 (B-min 最小実装、Storage / DB INSERT は 5/13 以降)
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
  });
}
