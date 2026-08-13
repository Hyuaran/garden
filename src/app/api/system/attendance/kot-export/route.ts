import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { authorizeKotExport } from "./_lib/authorization";
import { encodeKotCsv, getKotImportRange, type KotExportRow } from "./_lib/kot-csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const EXPORT_LIMIT = 1000;

async function hasSending(admin: ReturnType<typeof getSupabaseAdmin>) {
  const result = await admin.from("system_attendance_punches")
    .select("id", { count: "exact", head: true }).eq("kot_sync_status", "sending");
  if (result.error) throw result.error;
  return (result.count ?? 0) > 0;
}

export async function POST() {
  const authorization = await authorizeKotExport();
  if ("response" in authorization) return authorization.response;
  const admin = getSupabaseAdmin();
  try {
    if (await hasSending(admin)) return NextResponse.json({ ok: false, error: "生成済みの未確定CSVがあります。先に確定または取消を行ってください。" }, { status: 409 });
    const range = getKotImportRange();
    const { data, error } = await admin.from("system_attendance_punches")
      .select("id,punch_type,punched_at,root_employees:root_employees!system_attendance_punches_employee_id_fkey!inner(name,kot_employee_id)")
      .eq("kot_sync_status", "unsent")
      .gte("punched_at", range.from).lte("punched_at", range.to)
      .not("root_employees.kot_employee_id", "is", null)
      .neq("root_employees.kot_employee_id", "")
      .order("punched_at", { ascending: true }).order("id", { ascending: true }).limit(EXPORT_LIMIT);
    if (error) throw error;
    const candidates = (data ?? []) as unknown as KotExportRow[];
    if (!candidates.length) return NextResponse.json({ ok: false, error: "生成対象の未送信打刻がありません" }, { status: 409 });
    encodeKotCsv(candidates); // Validate everything before changing state.
    if (await hasSending(admin)) return NextResponse.json({ ok: false, error: "別の生成処理が開始されました。同期状況を再読み込みしてください。" }, { status: 409 });
    const ids = candidates.map((row) => row.id);
    const { data: claimed, error: claimError } = await admin.from("system_attendance_punches")
      .update({ kot_sync_status: "sending" }).eq("kot_sync_status", "unsent").in("id", ids).select("id");
    if (claimError) throw claimError;
    const claimedIds = new Set((claimed ?? []).map((row) => Number(row.id)));
    const claimedRows = candidates.filter((row) => claimedIds.has(row.id));
    if (!claimedRows.length) return NextResponse.json({ ok: false, error: "対象は別の処理で生成済みです。同期状況を再読み込みしてください。" }, { status: 409 });
    const csv = encodeKotCsv(claimedRows);
    const stamp = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date()).replace(/[-: ]/g, "");
    return new Response(new Uint8Array(csv), { headers: {
      "Content-Type": "text/csv; charset=Shift_JIS",
      "Content-Disposition": `attachment; filename="kot_punches_${stamp}.csv"`,
      "Cache-Control": "no-store",
      "X-KOT-Export-Count": String(claimedRows.length),
    } });
  } catch (error) {
    console.error("[system/attendance/kot-export] generation failed", { error: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ ok: false, error: error instanceof Error && error.message.startsWith("Shift-JIS") ? error.message : "KOT取込CSVを生成できませんでした" }, { status: 500 });
  }
}
