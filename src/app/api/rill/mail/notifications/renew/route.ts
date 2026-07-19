import { ensureMailSubscriptions } from "@/app/rill/mail/_lib/graph";
import { verifyCronRequest } from "@/lib/cron-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const auth = verifyCronRequest(request);
  if (!auth.ok) return Response.json({ error: auth.reason }, { status: auth.status });
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("rill_mail_tokens").select("user_id");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  let renewed = 0;
  let failed = 0;
  for (const row of data ?? []) {
    try { renewed += (await ensureMailSubscriptions(admin, { id: row.user_id as string }, new URL(request.url).origin)).renewed; }
    catch { failed += 1; }
  }
  return Response.json({ ok: failed === 0, users: data?.length ?? 0, renewed, failed });
}
