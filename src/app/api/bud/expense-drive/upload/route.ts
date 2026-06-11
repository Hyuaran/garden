/**
 * POST /api/bud/expense-drive/upload
 * 経費レシート画像を申請者本人の Google Drive フォルダへ保存する。
 *
 * 認証: Supabase セッション（cookie）。本人の root_employees 行から
 *       expense_drive_folder_id を取得してアップロード先にする。
 * 入力: FormData { file: Blob, filename?: string }
 * 出力: { ok: true, fileId, viewUrl } / { ok: false, error }
 *
 * 注意: Drive 保存は「申請者に見せる用」。失敗しても申請自体は
 *       Supabase Storage 側で成立する想定（呼び出し側でベストエフォート扱い）。
 */

import { NextResponse } from "next/server";

import { createServerClient } from "@/app/_lib/supabase/server";

import { uploadToFolder } from "../_lib/drive";

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient();
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "未ログインです" }, { status: 401 });
    }

    const { data: emp } = await supabase
      .from("root_employees")
      .select("employee_id, expense_drive_folder_id")
      .eq("user_id", userId)
      .maybeSingle<{ employee_id: string; expense_drive_folder_id: string | null }>();

    if (!emp) {
      return NextResponse.json({ ok: false, error: "社員情報が見つかりません" }, { status: 403 });
    }
    if (!emp.expense_drive_folder_id) {
      return NextResponse.json(
        { ok: false, error: "Drive の保存先フォルダが未設定です（経理に連絡してください）" },
        { status: 409 },
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ ok: false, error: "file がありません" }, { status: 400 });
    }
    const filename =
      (typeof form.get("filename") === "string" && (form.get("filename") as string)) ||
      `receipt-${Date.now()}.jpg`;

    const buf = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadToFolder(
      emp.expense_drive_folder_id,
      filename,
      buf,
      file.type || "image/jpeg",
    );

    return NextResponse.json({ ok: true, fileId: uploaded.id, viewUrl: uploaded.webViewLink });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Drive アップロードに失敗しました";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
