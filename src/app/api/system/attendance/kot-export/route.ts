import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { authorizeKotExport } from "./_lib/authorization";
import { encodeKotCsv, getKotImportRange, type KotExportRow } from "./_lib/kot-csv";
import { toJstDate, transformDayPunches, type KotTransformPunch } from "./_lib/kot-transform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const EXPORT_LIMIT = 1000;

type CandidateRow = KotTransformPunch & {
  employee_id: string;
  root_employees: {
    name?: string | null;
    kot_employee_id?: string | null;
    attendance_rule?: string | null;
  } | null;
};

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
      .select("id,employee_id,punch_type,punched_at,root_employees:root_employees!system_attendance_punches_employee_id_fkey!inner(name,kot_employee_id,attendance_rule)")
      .eq("kot_sync_status", "unsent")
      .gte("punched_at", range.from).lte("punched_at", range.to)
      .not("root_employees.kot_employee_id", "is", null)
      .neq("root_employees.kot_employee_id", "")
      .order("punched_at", { ascending: true }).order("id", { ascending: true }).limit(EXPORT_LIMIT);
    if (error) throw error;
    const candidates = (data ?? []) as unknown as CandidateRow[];
    if (!candidates.length) return NextResponse.json({ ok: false, error: "生成対象の未送信打刻がありません" }, { status: 409 });
    const groups = new Map<string, CandidateRow[]>();
    for (const row of candidates) {
      const key = `${row.employee_id}\t${toJstDate(row.punched_at)}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    const exportRows: KotExportRow[] = [];
    const claimedSourceIds: number[] = [];
    for (const group of groups.values()) {
      const first = group[0];
      const date = toJstDate(first.punched_at);
      const transformed = transformDayPunches({
        date,
        punches: group,
        isOffice: first.root_employees?.attendance_rule === "office",
      });
      if (transformed.issues.length || exportRows.length + transformed.punches.length > EXPORT_LIMIT) continue;
      claimedSourceIds.push(...group.map((row) => Number(row.id)));
      exportRows.push(...transformed.punches.map((punch) => ({
        ...punch,
        root_employees: first.root_employees,
      })));
    }
    if (!exportRows.length) return NextResponse.json({ ok: false, error: "生成対象の未送信打刻がありません" }, { status: 409 });
    exportRows.sort((left, right) => {
      const time = new Date(left.punched_at).getTime() - new Date(right.punched_at).getTime();
      if (time) return time;
      const leftCode = left.root_employees?.kot_employee_id ?? "";
      const rightCode = right.root_employees?.kot_employee_id ?? "";
      return leftCode.localeCompare(rightCode);
    });
    encodeKotCsv(exportRows); // Validate everything before changing state.
    if (await hasSending(admin)) return NextResponse.json({ ok: false, error: "別の生成処理が開始されました。同期状況を再読み込みしてください。" }, { status: 409 });
    const ids = claimedSourceIds;
    const batchId = crypto.randomUUID();
    const { data: claimed, error: claimError } = await admin.from("system_attendance_punches")
      .update({ kot_sync_status: "sending", kot_punched_at: null, kot_batch_id: batchId }).eq("kot_sync_status", "unsent").in("id", ids).select("id");
    if (claimError) throw claimError;
    const claimedIds = new Set((claimed ?? []).map((row) => Number(row.id)));
    const claimedRows = exportRows.filter((row) => row.source_punch_id === undefined || claimedIds.has(row.source_punch_id));
    if (!claimedRows.length || claimedIds.size !== ids.length) return NextResponse.json({ ok: false, error: "対象は別の処理で生成済みです。同期状況を再読み込みしてください。" }, { status: 409 });
    for (const row of claimedRows) {
      if (row.source_punch_id === undefined) continue;
      const { error: punchUpdateError } = await admin.from("system_attendance_punches")
        .update({ kot_punched_at: row.punched_at }).eq("id", row.source_punch_id).eq("kot_sync_status", "sending");
      if (punchUpdateError) throw punchUpdateError;
    }
    const batchRows = claimedRows.map((row) => ({
      employee_code: row.root_employees?.kot_employee_id?.trim() ?? "",
      name: row.root_employees?.name?.trim() ?? "",
      punch_type: row.punch_type,
      punched_at: row.punched_at,
      source_punch_id: row.source_punch_id ?? null,
    }));
    const { error: batchError } = await admin.from("system_attendance_kot_batch").insert({
      batch_id: batchId,
      csv_rows: batchRows,
      status: "sending",
    });
    if (batchError) throw batchError;
    const csv = encodeKotCsv(claimedRows);
    const stamp = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date()).replace(/[-: ]/g, "");
    return new Response(new Uint8Array(csv), { headers: {
      "Content-Type": "text/csv; charset=Shift_JIS",
      "Content-Disposition": `attachment; filename="kot_punches_${stamp}.csv"`,
      "Cache-Control": "no-store",
      "X-KOT-Export-Count": String(claimedRows.length),
      "X-KOT-Batch-Id": batchId,
    } });
  } catch (error) {
    console.error("[system/attendance/kot-export] generation failed", { error: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ ok: false, error: error instanceof Error && error.message.startsWith("Shift-JIS") ? error.message : "KOT取込CSVを生成できませんでした" }, { status: 500 });
  }
}
