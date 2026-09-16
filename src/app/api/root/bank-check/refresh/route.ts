import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/system/mypage/_lib/submission-server";
import { importBankMaster } from "@/app/api/system/bank-master-import/_lib";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  if (!(await requireAdmin())) return NextResponse.json({ ok: false }, { status: 403 });
  try {
    return NextResponse.json(await importBankMaster(getSupabaseAdmin()));
  } catch (error) {
    console.error("[bank-check-refresh] failed", error);
    return NextResponse.json({ ok: false, error: "台帳を更新できませんでした。時間をおいてもう一度お試しください。続くときは管理者へお問い合わせください。" }, { status: 500 });
  }
}
