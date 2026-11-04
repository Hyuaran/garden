export type Period = { start: string; end: string | null };

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

/** 日を維持し、存在しない日はその月の末日に丸める。 */
export function addMonths(value: string, months: number): string {
  if (!validDate(value)) throw new Error("日付を確認してください。");
  const date = new Date(value + "T00:00:00Z");
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date.toISOString().slice(0, 10);
}

export function addDays(value: string, days: number): string {
  if (!validDate(value)) throw new Error("日付を確認してください。");
  const date = new Date(value + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** 重複する契約は終端を延ばす。空きが３か月ちょうどなら連続とする。 */
export function continuousStart(periods: Period[], at: string): string | null {
  const sorted = periods
    .filter((p) => p.start <= at)
    .sort((a, b) => a.start.localeCompare(b.start));
  let start: string | null = null;
  let end: string | null = null;
  for (const period of sorted) {
    if (start === null || (end !== null && period.start > addMonths(end, 3))) {
      start = period.start;
      end = period.end;
    } else if (end !== null) {
      end =
        period.end === null
          ? null
          : period.end.localeCompare(end) > 0
            ? period.end
            : end;
    }
  }
  return start;
}

export function conflictDate(periods: Period[], at: string): string | null {
  const start = continuousStart(periods, at);
  return start ? addMonths(start, 36) : null;
}

export function individualConflictDate(
  periods: Period[],
  at: string,
  indefinite: boolean,
  over60: boolean,
) {
  return indefinite || over60 ? null : conflictDate(periods, at);
}

export const hearingDue = (conflict: string) => addMonths(conflict, -1);
export const renewalDue = (end: string) => addMonths(end, -1);
export const retentionDue = (end: string) => addMonths(end, 36);
export const conflictMismatch = (
  calculated: string | null,
  notified: string | null,
) => Boolean(calculated && notified && calculated !== notified);

export function canDeleteWorker(end: string | null, today: string): boolean {
  return !end || today >= retentionDue(end);
}

export function todayJst(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(
    now,
  );
}
