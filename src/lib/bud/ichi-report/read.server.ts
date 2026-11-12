import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { readSnapshot, type Snapshot, type Store } from "./snapshot";
let emptyFailure: { until: number; result: Awaited<ReturnType<typeof readSnapshot>> } | undefined;
let pending: ReturnType<typeof readSnapshot> | undefined;
export async function readIchiReport(force = false) {

  if(pending) return pending;

  if(!force && emptyFailure && Date.now() < emptyFailure.until) return emptyFailure.result;

  const db = getSupabaseAdmin();

  const store: Store = {
    async read() {

      const result = await db.from("bud_ichi_report_snapshot").select("*").eq("id", 1).maybeSingle();

      if(result.error) throw new Error("報告を読み込めませんでした");

      return result.data as Snapshot | null;
    },
    async save(snapshot) {

      const result = await db.from("bud_ichi_report_snapshot").upsert({ id: 1, ...snapshot });

      if(result.error) throw new Error("報告を読み込めませんでした");
    },
  };

  pending = readSnapshot(store, process.env.VERCEL_ICHI_REPORT_TOKEN || process.env.VERCEL_BILLING_TOKEN, force);
  try {

    const result = await pending;

    emptyFailure = result.snapshot ? undefined : { until: Date.now() + 600_000, result };

    return result;

  } finally {

    pending = undefined;
  }
}
