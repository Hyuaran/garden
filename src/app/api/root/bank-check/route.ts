import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/system/mypage/_lib/submission-server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { runBankAccountCheck } from "./_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ ok: false }, { status: 403 });
  try {
    return NextResponse.json({ ok: true, ...(await runBankAccountCheck(getSupabaseAdmin())) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[bank-check] failed", error);
    return NextResponse.json({ ok: false, error: "load_failed" }, { status: 500 });
  }
}
