import { NextResponse } from "next/server";
import { requireManager } from "@/app/system/mypage/_lib/submission-server";
import { getCurrentAddresses } from "@/app/root/_lib/profile-history.server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const manager = await requireManager();
  if (!manager) return NextResponse.json({ ok: false }, { status: 403 });
  const addresses = await getCurrentAddresses(getSupabaseAdmin());
  return NextResponse.json(addresses);
}
