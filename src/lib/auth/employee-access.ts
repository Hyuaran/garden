export type EmployeeAccessRow = {
  is_active?: boolean | null;
  termination_date?: string | null;
  deleted_at?: string | null;
};

export function tokyoDateString(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function isEmployeeActive(row: EmployeeAccessRow | null | undefined, today = tokyoDateString()): boolean {
  if (!row) return false;
  // is_active は問い合わせ側で絞っているのが基本。列を取っていない（undefined）場合は絞り込み済みとみなす
  if (row.is_active === false) return false;
  if (row.deleted_at) return false;
  if (!row.termination_date) return true;
  return row.termination_date > today;
}

export function shouldEmployeeBeActive(status: string | null | undefined, terminationDate: string | null | undefined, today = tokyoDateString()): boolean {
  return status === "在籍中" && (!terminationDate || terminationDate > today);
}

export function isRetiredByDate(terminationDate: string | null | undefined, today = tokyoDateString()): boolean {
  return Boolean(terminationDate && terminationDate <= today);
}
