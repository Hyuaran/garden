import { NextResponse } from "next/server";
import { createServerClient } from "@/app/_lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "未ログインです" }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, error: "依頼が見つかりません" }, { status: 404 });
  const { data, error } = await supabase.from("system_zenkaku_check_request").select("id,status,result,error_code,updated_at").eq("id", id).maybeSingle();
  if (error || !data) return NextResponse.json({ ok: false, error: "依頼が見つかりません" }, { status: 404 });
  return NextResponse.json({ ok: true, ...data });
}
