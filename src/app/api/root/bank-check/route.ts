import { systemViewResponse } from "@/lib/auth/view-permission.server";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { runBankAccountCheck } from "./_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await systemViewResponse("root-bank-check");
  if (denied) return denied;
  try {
    return NextResponse.json({ ok: true, ...(await runBankAccountCheck(getSupabaseAdmin())) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[bank-check] failed", error);
    return NextResponse.json({ ok: false, error: "load_failed" }, { status: 500 });
  }
}
