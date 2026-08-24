import { calculateTaxExcludedAmount } from "./expense-booking-groups";

export type ExpenseDoneRow = {
  id: string;
  status: string;
  deleted_at?: string | null;
  booking_date: string | null;
  booking_corp_id: string | null;
  amount: number | null;
};

export type DonePeriod = "month" | "three-months" | "year" | "all";

export function donePeriodStart(period: DonePeriod, now = new Date()) {
  if (period === "all") return null;
  const monthsBack = period === "month" ? 0 : period === "three-months" ? 2 : 11;
  const start = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;
}

export function donePeriodEnd(period: DonePeriod, now = new Date()) {
  if (period === "all") return null;
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-01`;
}

export function filterAndSortDoneRows<T extends ExpenseDoneRow>(rows: T[], corpId: string, start: string | null, end: string | null = null) {
  return rows
    .filter((row) => row.status === "journalized" && !row.deleted_at)
    .filter((row) => corpId === "all" || row.booking_corp_id === corpId)
    .filter((row) => !start || Boolean(row.booking_date && row.booking_date >= start))
    .filter((row) => !end || Boolean(row.booking_date && row.booking_date < end))
    .sort((a, b) => (b.booking_date ?? "").localeCompare(a.booking_date ?? ""));
}

export function summarizeDoneRows(rows: Array<{ amount: number | null }>) {
  const taxIncluded = rows.reduce((sum, row) => sum + (row.amount ?? 0), 0);
  return { count: rows.length, taxIncluded, taxExcluded: calculateTaxExcludedAmount(taxIncluded) };
}
