export type FiscalPeriod = {
  periodNo: number;
  start: string;
  end: string;
  deadline: string;
  expired: boolean;
};

type DateParts = {
  year: number;
  month: number;
  day: number;
};

export function calculateFiscalPeriod(
  establishedOn: string | null | undefined,
  fiscalEndMonth: number | null | undefined,
  targetDate: string | null | undefined,
  today = new Date(),
): FiscalPeriod | null {
  const established = parseIsoDate(establishedOn);
  const target = parseIsoDate(targetDate);
  if (!established || !target || !fiscalEndMonth || fiscalEndMonth < 1 || fiscalEndMonth > 12) return null;

  const establishedDate = toUtcDate(established);
  const targetUtc = toUtcDate(target);
  if (targetUtc.getTime() < establishedDate.getTime()) return null;

  let periodNo = 1;
  let start = established;
  let end = firstFiscalEnd(established, fiscalEndMonth);

  while (targetUtc.getTime() > toUtcDate(end).getTime()) {
    periodNo += 1;
    start = addDays(end, 1);
    end = monthEnd(end.year + 1, fiscalEndMonth);
  }

  const deadline = monthEnd(addMonth(end.year, end.month, 1).year, addMonth(end.year, end.month, 1).month);
  return {
    periodNo,
    start: formatDate(start),
    end: formatDate(end),
    deadline: formatDate(deadline),
    expired: startOfDayUtc(today).getTime() > toUtcDate(deadline).getTime(),
  };
}

export function formatFiscalDateRange(period: Pick<FiscalPeriod, "start" | "end">) {
  return `${formatDisplayDate(period.start)}〜${formatDisplayDate(period.end)}`;
}

export function formatDisplayDate(value: string) {
  return value.replaceAll("-", "/");
}

function firstFiscalEnd(established: DateParts, fiscalEndMonth: number): DateParts {
  const endYear = fiscalEndMonth >= established.month ? established.year : established.year + 1;
  return monthEnd(endYear, fiscalEndMonth);
}

function parseIsoDate(value: string | null | undefined): DateParts | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12) return null;
  const maxDay = monthEnd(year, month).day;
  if (day < 1 || day > maxDay) return null;
  return { year, month, day };
}

function monthEnd(year: number, month: number): DateParts {
  return { year, month, day: new Date(Date.UTC(year, month, 0)).getUTCDate() };
}

function addDays(parts: DateParts, days: number): DateParts {
  const date = toUtcDate(parts);
  date.setUTCDate(date.getUTCDate() + days);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function addMonth(year: number, month: number, delta: number): Pick<DateParts, "year" | "month"> {
  const zeroBased = month - 1 + delta;
  const nextYear = year + Math.floor(zeroBased / 12);
  const nextMonth = ((zeroBased % 12) + 12) % 12 + 1;
  return { year: nextYear, month: nextMonth };
}

function toUtcDate(parts: DateParts) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

function startOfDayUtc(date: Date) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

function formatDate(parts: DateParts) {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}
