import { calculateTaxExcludedAmount } from "./expense-booking-groups";

export type ExpenseDoneRow = {
  id: string;
  status: string;
  deleted_at?: string | null;
  booking_date: string | null;
  booking_corp_id: string | null;
  amount: number | null;
  yayoi_exported_at?: string | null;
  yayoi_export_count?: number | null;
};

export type DonePeriod = "month" | "three-months" | "year" | "all";
export const DONE_PAGE_SIZE = 100;

export function donePageBounds(page: number, totalCount: number, pageSize = DONE_PAGE_SIZE) {
  if (totalCount < 1) return { from: 0, to: 0, label: "0 / 0件", lastPage: 0 };
  const lastPage = Math.max(0, Math.ceil(totalCount / pageSize) - 1);
  const safePage = Math.min(Math.max(0, page), lastPage);
  const from = safePage * pageSize;
  const to = Math.min(from + pageSize, totalCount);
  return { from, to: to - 1, label: `${(from + 1).toLocaleString("ja-JP")}〜${to.toLocaleString("ja-JP")} / ${totalCount.toLocaleString("ja-JP")}件`, lastPage };
}

export function donePeriodStart(period: DonePeriod, now = new Date()) {
  if (period === "all") return null;
  const monthsBack = period === "month" ? 0 : period === "three-months" ? 2 : 11;
  const start = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;
}

export function formatYayoiExportRecord(row: Pick<ExpenseDoneRow, "yayoi_export_count" | "yayoi_exported_at">) {
  const count = row.yayoi_export_count ?? 0;
  if (count < 1) return "未出力";
  const date = formatJstDate(row.yayoi_exported_at);
  return `${count}回（最終 ${date ?? "日時不明"}）`;
}

export function buildReexportConfirmation(rows: Array<Pick<ExpenseDoneRow, "yayoi_export_count" | "yayoi_exported_at">>) {
  const exported = rows.filter((row) => (row.yayoi_export_count ?? 0) > 0);
  if (!exported.length) return null;
  const latest = exported.map((row) => row.yayoi_exported_at).filter((value): value is string => Boolean(value)).sort().at(-1);
  return `選択した${rows.length}件のうち${exported.length}件は出力済みです（最終 ${formatJstDate(latest) ?? "日時不明"}）。再出力しますか？`;
}

function formatJstDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
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
