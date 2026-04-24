/**
 * POST /api/forest/parse-pdf
 *
 * multipart/form-data で PDF を受け取り、pdfjs-dist で解析して
 * 会社/売上/外注/利益/期間を返す。admin ロールのみアクセス可。
 *
 * 認証: クライアント側で supabase.auth.getSession() した access_token を
 *       Authorization: Bearer <token> ヘッダで送る。
 *
 * レスポンス:
 *   200 OK: { success: true, data: ParsePdfResult }
 *   401 Unauthorized: { success: false, error: string }
 *   403 Forbidden: { success: false, error: string }
 *   400 Bad Request: { success: false, error: string }
 *   500 Internal Server Error: { success: false, error: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { extractFromPdf, isFinancialStatement } from "./_lib/extract";

// pdfjs-dist は Node.js runtime が必須（edge では動かない）
export const runtime = "nodejs";
// 長めの解析時間を許容
export const maxDuration = 30;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  // Authorization Bearer <jwt> を取得
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { success: false, error: "未認証です" },
      { status: 401 }
    );
  }
  const token = authHeader.slice(7);

  // ユーザー JWT を使った Supabase クライアント
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ユーザー取得
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser(token);

  if (userErr || !user) {
    return NextResponse.json(
      { success: false, error: "認証に失敗しました" },
      { status: 401 }
    );
  }

  // admin ロール確認
  const { data: forestUser, error: roleErr } = await supabase
    .from("forest_users")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleErr) {
    return NextResponse.json(
      { success: false, error: `権限確認に失敗: ${roleErr.message}` },
      { status: 500 }
    );
  }

  if (!forestUser || forestUser.role !== "admin") {
    return NextResponse.json(
      { success: false, error: "admin権限がありません" },
      { status: 403 }
    );
  }

  // ファイル取得
  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { success: false, error: "ファイルが見つかりません" },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 財務諸表チェック
  const isFS = await isFinancialStatement(buffer);
  if (!isFS) {
    return NextResponse.json(
      {
        success: false,
        error: "残高試算表/損益計算書/貸借対照表ではありません",
      },
      { status: 400 }
    );
  }

  // 抽出
  try {
    const data = await extractFromPdf(buffer, file.name);
    return NextResponse.json({ success: true, data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { success: false, error: `抽出失敗: ${msg}` },
      { status: 500 }
    );
  }
}
