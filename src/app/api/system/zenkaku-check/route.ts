import { NextResponse } from "next/server";
import { createServerClient } from "@/app/_lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "未ログインです" }, { status: 401 });
  let salesId = "";
  try { const body = await request.json(); salesId = typeof body.salesId === "string" ? body.salesId.trim() : ""; } catch { /* invalid below */ }
  if (!salesId || salesId.length > 100) return NextResponse.json({ ok: false, error: "営業IDを確認してください" }, { status: 400 });
  const { data, error } = await supabase.from("system_zenkaku_check_request")
    .insert({ sales_id: salesId, requested_by: auth.user.id, status: "pending" }).select("id,status").single();
  if (error || !data) return NextResponse.json({ ok: false, error: "確認依頼を作成できませんでした" }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id, status: data.status }, { status: 201 });
}
