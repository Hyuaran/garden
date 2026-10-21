import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { syncLinkAlerts } from "@/lib/bud/mf/link-alerts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: Request) {
 const auth = verifyCronRequest(request);
 if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.status });
 try { return NextResponse.json(await syncLinkAlerts(getSupabaseAdmin())); }
 catch { return NextResponse.json({ error: "知らせメールを読み込めませんでした" }, { status: 500 }); }
}
