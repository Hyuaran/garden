export function isOnboardingLoginTarget(employee: { garden_role?: string | null; hire_date?: string | null } | null) {
  if (!employee || employee.garden_role === "outsource") return false;
  if (["toss", "closer"].includes(employee.garden_role ?? "")) return !!employee.hire_date && /^\d{4}-\d{2}-\d{2}$/.test(employee.hire_date) && employee.hire_date >= "2026-10-25";
  return true;
}
