const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function elapsedBusinessDaysSince(from: string | Date, to: string | Date = new Date()) {
  const start = toDateOnly(from);
  const end = toDateOnly(to);
  if (!start || !end || end.getTime() <= start.getTime()) return 0;

  let days = 0;
  for (let time = start.getTime() + MS_PER_DAY; time <= end.getTime(); time += MS_PER_DAY) {
    if (isBusinessDay(new Date(time))) days += 1;
  }
  return days;
}

export function isBusinessDay(date: Date) {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

function toDateOnly(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}
