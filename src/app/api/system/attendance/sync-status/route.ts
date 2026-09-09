import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { MANAGER_ROLES } from "@/app/system/_lib/attendance";
import { resolveAttendanceEmployee } from "../_lib/auth";
import { getKotImportRange } from "../kot-export/_lib/kot-csv";
import { toJstDate, transformDayPunches, type KotTransformPunch } from "../kot-export/_lib/kot-transform";

export const dynamic = "force-dynamic";
const LIST_LIMIT = 200;

type UnsentRow = KotTransformPunch & {
  employee_id: string;
  root_employees: {
    name?: string | null;
    kot_employee_id?: string | null;
    attendance_rule?: string | null;
  } | null;
};

function timeText(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

export async function GET() {
  const identity = await resolveAttendanceEmployee();
  if (!identity.ok) return NextResponse.json({ ok: false, error: identity.error, error_code: "errorCode" in identity ? identity.errorCode : undefined }, { status: identity.status });
  if (!MANAGER_ROLES.has(identity.employee.gardenRole)) return NextResponse.json({ ok: false, error: "閲覧権限がありません" }, { status: 403 });
  const admin = getSupabaseAdmin();
  const statuses = ["unsent", "sending", "synced", "failed", "resend_wait", "needs_check"];
  const countResults = await Promise.all(statuses.map((status) => admin.from("system_attendance_punches")
    .select("id", { count: "exact", head: true }).eq("kot_sync_status", status)));
  if (countResults.some((result) => result.error)) return NextResponse.json({ ok: false, error: "同期状況を取得できませんでした" }, { status: 500 });
  const counts = Object.fromEntries(statuses.map((status, index) => [status, countResults[index].count ?? 0]));
  const unsentRows: UnsentRow[] = [];
  for (let from = 0; ; from += 1000) {
    const result = await admin.from("system_attendance_punches")
      .select("id,employee_id,punch_type,punched_at,root_employees:root_employees!system_attendance_punches_employee_id_fkey(name,kot_employee_id,attendance_rule)")
      .eq("kot_sync_status", "unsent").range(from, from + 999);
    if (result.error) return NextResponse.json({ ok: false, error: "同期状況を取得できませんでした" }, { status: 500 });
    const rows = (result.data ?? []) as unknown as UnsentRow[];
    unsentRows.push(...rows);
    if (rows.length < 1000) break;
  }
  const range = getKotImportRange();
  const missingCodeRows = unsentRows.filter((row) => !row.root_employees?.kot_employee_id?.trim());
  const outOfRangeRows = unsentRows.filter((row) => row.punched_at < range.from || row.punched_at > range.to);
  const groups = new Map<string, UnsentRow[]>();
  unsentRows.filter((row) => row.root_employees?.kot_employee_id?.trim() && row.punched_at >= range.from && row.punched_at <= range.to).forEach((row) => {
    const key = `${row.employee_id}\t${toJstDate(row.punched_at)}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });
  const exportPreview = [...groups.values()].map((group) => {
    const first = group[0];
    const date = toJstDate(first.punched_at);
    const transformed = transformDayPunches({
      date,
      punches: group,
      isOffice: first.root_employees?.attendance_rule === "office",
    });
    const clockIn = transformed.punches.find((punch) => punch.punch_type === "clock_in");
    const clockOut = transformed.punches.filter((punch) => punch.punch_type === "clock_out").at(-1);
    return {
      employeeId: first.employee_id,
      name: first.root_employees?.name?.trim() || "従業員不明",
      kotEmployeeId: first.root_employees?.kot_employee_id?.trim() || "",
      attendanceRule: first.root_employees?.attendance_rule === "office" ? "office" : "sales",
      note: first.root_employees?.name?.trim() === "小谷　庵" || first.root_employees?.name?.trim() === "小谷 庵" ? "営業事務（数え方は検討中）" : null,
      date,
      lineCount: transformed.punches.length,
      needsCheck: transformed.issues.length > 0,
      issues: transformed.issues.map((issue) => issue.message),
      clockIn: clockIn ? timeText(clockIn.punched_at) : transformed.roundedClockIn,
      clockOut: clockOut ? timeText(clockOut.punched_at) : transformed.roundedClockOut,
      breakIncluded: transformed.breakIncluded,
      rawPunches: [...group].sort((left, right) => left.punched_at.localeCompare(right.punched_at)).map((row) => ({ id: row.id, type: row.punch_type, time: timeText(row.punched_at) })),
    };
  }).sort((left, right) => Number(right.needsCheck) - Number(left.needsCheck) || left.date.localeCompare(right.date) || left.name.localeCompare(right.name, "ja"));
  const exportSummary = {
    eligible: exportPreview.filter((row) => !row.needsCheck).reduce((sum, row) => sum + row.lineCount, 0),
    missingCode: missingCodeRows.length,
    missingCodeNames: [...new Set(missingCodeRows.map((row) => row.root_employees?.name?.trim() || "従業員不明"))],
    outOfRange: outOfRangeRows.length,
    needsCheck: exportPreview.filter((row) => row.needsCheck).length,
  };
  const { data, error } = await admin.from("system_attendance_punches")
    .select("id,employee_id,punch_type,punched_at,kot_sync_status,root_employees:root_employees!system_attendance_punches_employee_id_fkey(name,kot_employee_id,attendance_rule)")
    .in("kot_sync_status", ["unsent", "sending", "failed", "resend_wait", "needs_check"])
    .order("punched_at", { ascending: false }).limit(LIST_LIMIT);
  if (error) return NextResponse.json({ ok: false, error: "同期状況を取得できませんでした" }, { status: 500 });
  return NextResponse.json({ ok: true, counts, exportSummary, exportPreview, punches: data ?? [], limit: LIST_LIMIT });
}
