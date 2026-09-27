import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

import { requireSoilListUser } from "../_lib/auth";
import { loadTableCounts, type TableCountsDb } from "../_lib/table-counts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireSoilListUser();
  if (!auth.ok) return auth.response;

  try {
    const result = await loadTableCounts(getSupabaseAdmin() as unknown as TableCountsDb);
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ ok: false, error: "件数を読み込めませんでした" }, { status: 500 });
  }
}
