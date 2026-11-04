import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isShiftActive, type ShiftEmployee, type ShiftSubmitterSetting } from "./eligibility";

function check(error: unknown) {
  if (error) throw new Error("提出する人の設定を処理できませんでした。");
}

export async function readSubmitterSettings(): Promise<ShiftSubmitterSetting[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("system_shift_submitter")
    .select("employee_id,mode");
  check(error);
  return data ?? [];
}

export async function readSubmitters() {
  const settings = await readSubmitterSettings();
  const { data, error } = await getSupabaseAdmin()
    .from("root_employees_with_team")
    .select("employee_id,employee_number,name,name_kana,employment_type,business,current_team,is_active,termination_date,deleted_at");
  check(error);
  const employees = ((data ?? []) as ShiftEmployee[])
    .filter(employee => isShiftActive(employee))
    .sort((a, b) => (a.current_team ?? "").localeCompare(b.current_team ?? "", "ja") ||
      (a.employee_number ?? a.employee_id).localeCompare(b.employee_number ?? b.employee_id, "ja", { numeric: true }));
  return { settings, employees };
}

export async function writeSubmitter(
  employeeId: string,
  mode: ShiftSubmitterSetting["mode"] | null,
  actor: string,
) {
  const db = getSupabaseAdmin();
  if (mode) {
    const people = await readSubmitters();
    if (!people.employees.some(employee => employee.employee_id === employeeId)) {
      return false;
    }
  }
  const result = mode
    ? await db.from("system_shift_submitter").upsert({
        employee_id: employeeId,
        mode,
        updated_at: new Date().toISOString(),
        updated_by: actor,
      })
    : await db.from("system_shift_submitter").delete().eq("employee_id", employeeId);
  check(result.error);
  return true;
}
