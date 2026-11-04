export type ShiftEmployee = {
  employee_id: string;
  name: string;
  employee_number?: string;
  employment_type?: string;
  business?: string | null;
  current_team?: string | null;
  is_active?: boolean;
  termination_date?: string | null;
  deleted_at?: string | null;
  line_user_id?: string | null;
  line_link_source?: string | null;
};
export type ShiftSubmitterSetting = {
  employee_id: string;
  mode: "include" | "exclude";
};

export function isShiftActive(
  employee: ShiftEmployee,
  today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }),
) {
  return employee.is_active === true && !employee.deleted_at &&
    (!employee.termination_date || employee.termination_date > today);
}

export function isShiftEligible(
  employee: ShiftEmployee,
  settings: readonly ShiftSubmitterSetting[] = [],
  today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }),
) {
  if (!isShiftActive(employee, today)) return false;
  const setting = settings.find(row => row.employee_id === employee.employee_id);
  if (setting) return setting.mode === "include";
  return employee.employment_type === "アルバイト" &&
    employee.business === "ブロードバンド事業" &&
    Boolean(employee.current_team) &&
    !["バックヤード", "所属なし"].includes(employee.current_team!);
}
