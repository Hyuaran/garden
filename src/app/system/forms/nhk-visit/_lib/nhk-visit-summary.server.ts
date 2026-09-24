import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { NhkVisitSummaryRow } from "./nhk-visit-summary";

export async function loadNhkVisitRows(startDate: string, endDate: string): Promise<NhkVisitSummaryRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("system_nhk_visit_report")
    .select("visit_date,start_time,end_time,destination,new_ground,new_satellite,address_ground,address_satellite,bank_credit,employee_number,employee_name")
    .gte("visit_date", startDate)
    .lte("visit_date", endDate)
    .order("visit_date", { ascending: true })
    .order("employee_name", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    visit_date: String(row.visit_date),
    start_time: String(row.start_time),
    end_time: String(row.end_time),
    destination: String(row.destination),
    new_ground: Number(row.new_ground) || 0,
    new_satellite: Number(row.new_satellite) || 0,
    address_ground: Number(row.address_ground) || 0,
    address_satellite: Number(row.address_satellite) || 0,
    bank_credit: Number(row.bank_credit) || 0,
    employee_number: row.employee_number == null ? null : String(row.employee_number),
    employee_name: String(row.employee_name),
  }));
}

export function monthStart(dateOrMonth: string) {
  return `${dateOrMonth.slice(0, 7)}-01`;
}

export function monthEnd(dateOrMonth: string) {
  const [year, month] = dateOrMonth.slice(0, 7).split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function summaryLoadStart(date: string) {
  const candidates = [monthStart(date), addDays(date, -7), addDays(date, -1)];
  return candidates.sort()[0];
}
