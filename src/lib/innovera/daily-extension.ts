import type { SupabaseClient } from "@supabase/supabase-js";
import type { GardenRole } from "@/app/root/_constants/types";

export type DailyExtensionWindow = {
  extension: string;
  from: string;
  to: string;
  endedAt: string | null;
  endedReason: string | null;
};

export type DailyExtensionEmployee = {
  id: string;
  name: string;
  gardenRole: string;
  innoveraExtension?: string | null;
  innoveraMobileExtension?: string | null;
};

export const DAILY_EXTENSION_ROLES = new Set<GardenRole>(["toss", "closer", "outsource"]);

export function tokyoToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function tokyoDayEndIso(workDate: string) {
  return new Date(`${workDate}T24:00:00+09:00`).toISOString();
}

export function needsDailyExtension(employee: DailyExtensionEmployee) {
  return DAILY_EXTENSION_ROLES.has(employee.gardenRole as GardenRole)
    && !String(employee.innoveraExtension ?? "").trim()
    && !String(employee.innoveraMobileExtension ?? "").trim();
}

export function normalizeExtension(value: unknown) {
  return String(value ?? "").trim();
}

export function validateDailyExtension(value: unknown) {
  const extension = normalizeExtension(value);
  if (!extension) return { ok: false as const, status: 400 as const, error: "今日の内線番号を入力してください" };
  if (!/^\d{3,5}$/.test(extension)) return { ok: false as const, status: 400 as const, error: "内線番号は数字で入力してください" };
  return { ok: true as const, extension };
}

function familyName(name: string) {
  return name.trim().split(/\s|　/)[0] || name.trim();
}

async function activeEmployees(admin: SupabaseClient) {
  const { data, error } = await admin
    .from("root_employees")
    .select("employee_id,name,innovera_extension,innovera_mobile_extension,is_active,deleted_at")
    .eq("is_active", true)
    .is("deleted_at", null);
  if (error) throw new Error("内線番号を確認できませんでした");
  return data ?? [];
}

export async function validateExtensionAvailability(
  admin: SupabaseClient,
  employeeId: string,
  extension: string,
  workDate = tokyoToday(),
) {
  const employees = await activeEmployees(admin);
  const fixedOwner = employees.find((employee) => {
    if (String(employee.employee_id ?? "") === employeeId) return false;
    const pc = normalizeExtension(employee.innovera_extension);
    const mobile = normalizeExtension(employee.innovera_mobile_extension);
    return pc === extension || mobile === extension;
  });
  if (fixedOwner) {
    return { ok: false as const, status: 409 as const, error: "この内線は固定席の番号です。管理者へ問い合わせてください" };
  }

  const { data: activeRows, error } = await admin
    .from("system_innovera_daily_extension")
    .select("id,employee_id,extension,work_date,ended_at")
    .eq("extension", extension)
    .eq("work_date", workDate)
    .is("ended_at", null);
  if (error) throw new Error("内線番号を確認できませんでした");
  const other = (activeRows ?? []).find((row) => String(row.employee_id ?? "") !== employeeId);
  if (!other) return { ok: true as const };

  const owner = employees.find((employee) => String(employee.employee_id ?? "") === String(other.employee_id ?? ""));
  const ownerName = familyName(String(owner?.name ?? "ほかの従業員"));
  return { ok: false as const, status: 409 as const, error: `この内線は ${ownerName}さんが使用中です。管理者へ問い合わせてください` };
}

export async function getActiveDailyExtensionForEmployee(
  admin: SupabaseClient,
  employeeId: string,
  workDate = tokyoToday(),
) {
  const { data, error } = await admin
    .from("system_innovera_daily_extension")
    .select("id,employee_id,extension,work_date,started_at,ended_at,ended_reason")
    .eq("employee_id", employeeId)
    .eq("work_date", workDate)
    .is("ended_at", null)
    .maybeSingle();
  if (error) throw new Error("内線番号を確認できませんでした");
  return data ?? null;
}

export async function reserveDailyExtensionForClockIn(
  admin: SupabaseClient,
  employeeId: string,
  extension: string,
  workDate = tokyoToday(),
) {
  const current = await getActiveDailyExtensionForEmployee(admin, employeeId, workDate);
  if (current) {
    if (String(current.extension) === extension) return { ok: true as const, row: current, created: false as const };
    return { ok: false as const, status: 409 as const, error: `今日は ${current.extension} を登録済みです。変更は管理者へ` };
  }
  const available = await validateExtensionAvailability(admin, employeeId, extension, workDate);
  if (!available.ok) return available;
  const { data, error } = await admin
    .from("system_innovera_daily_extension")
    .insert({ employee_id: employeeId, work_date: workDate, extension, source: "clock_in" })
    .select("id,employee_id,extension,work_date,started_at,ended_at,ended_reason")
    .single();
  if (error || !data) throw new Error("内線番号を登録できませんでした");
  return { ok: true as const, row: data, created: true as const };
}

export async function attachPunchToDailyExtension(admin: SupabaseClient, rowId: unknown, punchId: unknown) {
  await admin.from("system_innovera_daily_extension").update({ punch_id: punchId }).eq("id", rowId);
}

export async function rollbackDailyExtensionReservation(admin: SupabaseClient, rowId: unknown) {
  await admin.from("system_innovera_daily_extension").delete().eq("id", rowId);
}

export async function endActiveDailyExtensionForClockOut(
  admin: SupabaseClient,
  employeeId: string,
  workDate = tokyoToday(),
) {
  await admin
    .from("system_innovera_daily_extension")
    .update({ ended_at: new Date().toISOString(), ended_reason: "clock_out" })
    .eq("employee_id", employeeId)
    .eq("work_date", workDate)
    .is("ended_at", null);
}

export async function loadDailyExtensionWindows(
  supabase: SupabaseClient,
  employeeId: string,
  workDate = tokyoToday(),
): Promise<DailyExtensionWindow[]> {
  const { data, error } = await supabase
    .from("system_innovera_daily_extension")
    .select("extension,started_at,ended_at,ended_reason")
    .eq("employee_id", employeeId)
    .eq("work_date", workDate)
    .order("started_at", { ascending: true });
  if (error) throw new Error("内線番号を確認できませんでした");
  const dayEnd = tokyoDayEndIso(workDate);
  return (data ?? []).map((row) => ({
    extension: String(row.extension ?? ""),
    from: String(row.started_at ?? ""),
    to: row.ended_at ? String(row.ended_at) : dayEnd,
    endedAt: row.ended_at ? String(row.ended_at) : null,
    endedReason: row.ended_reason ? String(row.ended_reason) : null,
  })).filter((row) => row.extension && row.from);
}

export function callInOwnWindow(
  call: { extension: string; startTime: string | null },
  windows: DailyExtensionWindow[] | undefined,
) {
  if (!windows?.length || !call.startTime) return false;
  const started = new Date(call.startTime.replace(" ", "T") + "+09:00").getTime();
  if (!Number.isFinite(started)) return false;
  return windows.some((window) => {
    if (window.extension !== call.extension) return false;
    const from = new Date(window.from).getTime();
    const to = new Date(window.to).getTime();
    return Number.isFinite(from) && Number.isFinite(to) && started >= from && started <= to;
  });
}
