/**
 * POST /api/bud/expense-drive/rename
 * 経理承認時に、Drive 上のレシートファイルを内容確定後の名前へ自動リネームする。
 *   形式: {レシート日付YYYYMMDD}_{時刻HHMM|9999}_{社員番号}_{店名}_{金額}.jpg
 *   例:   20260512_1139_0008_三井のリパーク_500.jpg
 *   時刻はレシートから読めた場合のみ。不明は 9999（0000 だと深夜0時と衝突するため）。
 *
 * 認証: Supabase セッション + bud_has_access()。
 * 入力: JSON { requestId: string }
 * 出力: { ok: true, name } / { ok: true, skipped } / { ok: false, error }
 * ベストエフォート（失敗しても業務処理は止めない前提で呼ぶ）。
 */

import { NextResponse } from "next/server";

import { createServerClient } from "@/app/_lib/supabase/server";

import { getDriveAccessToken } from "../_lib/drive";

function sanitize(part: string): string {
  // Drive で問題になる '/' と前後空白だけ除去（日本語はそのまま使える）
  return part.replace(/[/\\]/g, "-").trim();
}

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

    const body = (await req.json()) as { requestId?: string };
    if (!body.requestId) {
      return NextResponse.json({ ok: false, error: "requestId がありません" }, { status: 400 });
    }

    const { data: row } = await supabase
      .from("bud_expense_requests")
      .select("drive_file_id, applicant_employee_id, receipt_date, receipt_time, store_name, amount")
      .eq("id", body.requestId)
      .maybeSingle<{
        drive_file_id: string | null;
        applicant_employee_id: string | null;
        receipt_date: string | null;
        receipt_time: string | null;
        store_name: string | null;
        amount: number | null;
      }>();

    if (!row) {
      return NextResponse.json({ ok: false, error: "申請が見つかりません" }, { status: 404 });
    }
    if (!row.drive_file_id) {
      return NextResponse.json({ ok: true, skipped: "drive_file_id なし" });
    }

    const ymd = row.receipt_date ? row.receipt_date.replaceAll("-", "") : "日付不明";
    // 時刻はレシートから読めた場合のみ HHMM。不明は 9999（0000=深夜0時との衝突回避）
    const hm = row.receipt_time ? row.receipt_time.slice(0, 5).replace(":", "") : "9999";
    const empNo = (row.applicant_employee_id ?? "").replace(/^EMP-/, "") || "番号不明";
    const store = sanitize(row.store_name ?? "店名不明");
    const amount = row.amount != null ? String(row.amount) : "金額不明";
    const name = `${ymd}_${hm}_${empNo}_${store}_${amount}.jpg`;

    const token = await getDriveAccessToken();
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${row.drive_file_id}?fields=id,name`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(`Drive rename error: ${res.status} ${await res.text()}`);

    return NextResponse.json({ ok: true, name });
  } catch (e) {
    const message = e instanceof Error ? e.message : "リネームに失敗しました";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
