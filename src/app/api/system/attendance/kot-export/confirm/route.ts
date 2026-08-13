import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { authorizeKotExport } from "../_lib/authorization";

export async function POST() {
  const authorization = await authorizeKotExport();
  if ("response" in authorization) return authorization.response;
  const { data, error } = await getSupabaseAdmin().from("system_attendance_punches")
    .update({ kot_sync_status: "synced", kot_synced_at: new Date().toISOString() })
    .eq("kot_sync_status", "sending").select("id");
  if (error) return NextResponse.json({ ok: false, error: "送信済みに確定できませんでした" }, { status: 500 });
  return NextResponse.json({ ok: true, updated: data?.length ?? 0 });
}
