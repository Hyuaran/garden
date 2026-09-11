import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

import { requireSoilListUser } from "../../_lib/auth";
import { loadOrderSyncState, type OrderSyncDb } from "../_lib/order-sync";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireSoilListUser();
  if (!auth.ok) return auth.response;

  try {
    const db = getSupabaseAdmin() as unknown as OrderSyncDb;
    return NextResponse.json({ ok: true, state: await loadOrderSyncState(db) });
  } catch {
    return NextResponse.json({ ok: false, error: "受注履歴の反映状態を取得できませんでした" }, { status: 500 });
  }
}
