import { NextResponse } from "next/server";
import { requireViewEmployee } from "@/lib/auth/system-view-api.server";
import { withPgClient } from "@/lib/db/pg";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { syncOrders, type OrderSyncDb } from "../_lib/order-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
const lockId = 53320261113;
const wait = () => NextResponse.json({ ok: false, error: "少し待ってからもう一度押してください" }, { status: 429 });

export async function POST() {
  if (!await requireViewEmployee("system-list", "list", "manager")) {
    return NextResponse.json({ ok: false, error: "権限がありません" }, { status: 403 });
  }
  try {
    return await withPgClient(async client => {
      const lock = await client.query("select pg_try_advisory_lock($1) as acquired", [lockId]);
      if (!lock.rows[0]?.acquired) return wait();
      try {
        // 試行時刻を DB に残し、別インスタンスや失敗直後の連打も止める。
        const recent = await client.query("select updated_at from soil_list_order_sync_state where id = 1");
        const last = recent.rows[0]?.updated_at;
        if (last && Date.now() - new Date(last).getTime() < 60_000) return wait();
        await client.query("insert into soil_list_order_sync_state (id, updated_at) values (1, now()) on conflict (id) do update set updated_at = excluded.updated_at");
        return NextResponse.json(await syncOrders({ db: getSupabaseAdmin() as unknown as OrderSyncDb }));
      } finally {
        await client.query("select pg_advisory_unlock($1)", [lockId]);
      }
    });
  } catch {
    return NextResponse.json({ ok: false, error: "受注履歴を取り込めませんでした" }, { status: 500 });
  }
}
