import { PROFILE_CATEGORIES, type ProfileHistoryRow } from "@/app/root/_lib/profile-history.server";
export const SELF_CONFIRM_CATEGORIES = PROFILE_CATEGORIES;
export function effectiveConfirmations(rows: ProfileHistoryRow[], hireDate: string | null, now = Date.now()) {
 const out: Record<string,string> = {};
 const recentHire = hireDate && now - Date.parse(hireDate) >= 0 && now - Date.parse(hireDate) < 90 * 86400000;
 for (const row of rows) {
  const value = row.confirmed_by_employee_at || (recentHire && row.source === "onboarding" ? row.recorded_at : null);
  if (value && Number.isFinite(Date.parse(value)) && (!out[row.category] || Date.parse(value) > Date.parse(out[row.category]))) out[row.category] = value;
 }
 return out;
}
export function needsQuarterlyConfirmation(confirmations: Record<string,string>, now = Date.now()) {
 return SELF_CONFIRM_CATEGORIES.some(category => !confirmations[category] || !Number.isFinite(Date.parse(confirmations[category])) || now - Date.parse(confirmations[category]) > 90 * 86400000);
}
