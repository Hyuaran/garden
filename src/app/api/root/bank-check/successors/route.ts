import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/system/mypage/_lib/submission-server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { addBankSuccessor } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const actor = await requireAdmin();
  if (!actor) return NextResponse.json({ ok: false }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  try {
    return NextResponse.json(await addBankSuccessor(getSupabaseAdmin(), actor.employee_number, body));
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "successor_failed" }, { status: 400 });
  }
}
