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
export function isShiftEligible(
  e: ShiftEmployee,
  today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }),
) {
  return (
    e.employment_type === "アルバイト" &&
    e.business === "ブロードバンド事業" &&
    Boolean(e.current_team) &&
    !["バックヤード", "所属なし"].includes(e.current_team!) &&
    e.is_active === true &&
    !e.deleted_at &&
    (!e.termination_date || e.termination_date > today)
  );
}
