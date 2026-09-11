import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyBearerRequest } from "@/lib/cron-auth";

import { saveOrderSyncState, syncOrders, type OrderSyncDb } from "../_lib/order-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const auth = verifyBearerRequest(request, "CRON_SECRET");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.reason }, { status: auth.status });

  const db = getSupabaseAdmin() as unknown as OrderSyncDb;
  try {
    return NextResponse.json(await syncOrders({ db }));
  } catch (error) {
    await saveOrderSyncState(db, { last_error: error instanceof Error ? error.message : "order_sync_failed" }).catch(() => undefined);
    return NextResponse.json({ ok: false, error: "受注履歴を取り込めませんでした" }, { status: 500 });
  }
}
