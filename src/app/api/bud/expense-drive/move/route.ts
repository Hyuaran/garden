/**
 * POST /api/bud/expense-drive/move
 * 経費レシートの Drive ファイルを、申請者フォルダ内の状態別サブフォルダへ移動する。
 *   action: "returned" → 0_差戻し / "approved" → 1_承認
 *
 * 認証: Supabase セッション + bud_has_access()（経理レビュー操作者のみ）。
 * 入力: JSON { requestId: string, action: "returned" | "approved" }
 * 出力: { ok: true } / { ok: false, error }
 *
 * サブフォルダが無い場合は自動作成（社員フォルダ追加直後でも動くように）。
 */

import { NextResponse } from "next/server";

import { createServerClient } from "@/app/_lib/supabase/server";

import { findOrCreateSubfolder, moveFile } from "../_lib/drive";

const SUBFOLDER: Record<string, string> = {
  returned: "0_差戻し",
  approved: "1_承認",
  completed: "2_完了",
};

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user?.id) {
      return NextResponse.json({ ok: false, error: "未ログインです" }, { status: 401 });
    }
    const { data: hasAccess } = await supabase.rpc("bud_has_access");
    if (!hasAccess) {
      return NextResponse.json({ ok: false, error: "Bud の権限がありません" }, { status: 403 });
    }

    const body = (await req.json()) as { requestId?: string; action?: string };
    const requestId = body.requestId;
    const subfolderName = body.action ? SUBFOLDER[body.action] : undefined;
    if (!requestId || !subfolderName) {
      return NextResponse.json({ ok: false, error: "requestId / action が不正です" }, { status: 400 });
    }

    const { data: row } = await supabase
      .from("bud_expense_requests")
      .select("drive_file_id, applicant_employee_id")
      .eq("id", requestId)
      .maybeSingle<{ drive_file_id: string | null; applicant_employee_id: string | null }>();

    if (!row) {
      return NextResponse.json({ ok: false, error: "申請が見つかりません" }, { status: 404 });
    }
    if (!row.drive_file_id) {
      // Drive 未保存の旧データ等。移動対象なし＝成功扱い（呼び出し側を止めない）
      return NextResponse.json({ ok: true, skipped: "drive_file_id なし" });
    }
    if (!row.applicant_employee_id) {
      return NextResponse.json({ ok: false, error: "申請者が未設定です" }, { status: 409 });
    }

    const { data: emp } = await supabase
      .from("root_employees")
      .select("expense_drive_folder_id")
      .eq("employee_id", row.applicant_employee_id)
      .maybeSingle<{ expense_drive_folder_id: string | null }>();

    if (!emp?.expense_drive_folder_id) {
      return NextResponse.json({ ok: true, skipped: "申請者の Drive フォルダ未設定" });
    }

    const subfolderId = await findOrCreateSubfolder(emp.expense_drive_folder_id, subfolderName);
    await moveFile(row.drive_file_id, subfolderId);

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Drive 移動に失敗しました";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
