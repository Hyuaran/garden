/**
 * POST /api/bud/expense-drive/update-content
 * Drive 上のレシート画像の中身を差し替える（経理レビューでの回転補正の反映用）。
 * ファイル名・場所・IDは変えず、画像データだけ更新する。
 *
 * 認証: Supabase セッション + bud_has_access()。
 * 入力: FormData { requestId: string, file: Blob }
 * 出力: { ok: true } / { ok: true, skipped } / { ok: false, error }
 * ベストエフォート（失敗しても業務処理は止めない前提で呼ぶ）。
 */

import { NextResponse } from "next/server";

import { createServerClient } from "@/app/_lib/supabase/server";

import { getDriveAccessToken } from "../_lib/drive";

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

    const form = await req.formData();
    const requestId = form.get("requestId");
    const file = form.get("file");
    if (typeof requestId !== "string" || !(file instanceof Blob)) {
      return NextResponse.json({ ok: false, error: "requestId / file が不正です" }, { status: 400 });
    }

    const { data: row } = await supabase
      .from("bud_expense_requests")
      .select("drive_file_id")
      .eq("id", requestId)
      .maybeSingle<{ drive_file_id: string | null }>();

    if (!row) {
      return NextResponse.json({ ok: false, error: "申請が見つかりません" }, { status: 404 });
    }
    if (!row.drive_file_id) {
      return NextResponse.json({ ok: true, skipped: "drive_file_id なし" });
    }

    const token = await getDriveAccessToken();
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${row.drive_file_id}?uploadType=media`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": file.type || "image/jpeg" },
        body: Buffer.from(await file.arrayBuffer()),
      },
    );
    if (!res.ok) throw new Error(`Drive content update error: ${res.status} ${await res.text()}`);

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "画像更新に失敗しました";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
