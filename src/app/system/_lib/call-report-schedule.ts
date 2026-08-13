const JST_TIME_ZONE = "Asia/Tokyo";

// Cabinet Office published holidays/holidays-in-lieu for 2026 and 2027.
// Update after the Cabinet Office publishes the following year's calendar.
const JAPAN_HOLIDAYS = new Set([
  "2026-01-01", "2026-01-12", "2026-02-11", "2026-02-23", "2026-03-20",
  "2026-04-29", "2026-05-03", "2026-05-04", "2026-05-05", "2026-05-06",
  "2026-07-20", "2026-08-11", "2026-09-21", "2026-09-22", "2026-09-23",
  "2026-10-12", "2026-11-03", "2026-11-23",
  "2027-01-01", "2027-01-11", "2027-02-11", "2027-02-23", "2027-03-21",
  "2027-03-22", "2027-04-29", "2027-05-03", "2027-05-04", "2027-05-05",
  "2027-07-19", "2027-08-11", "2027-09-20", "2027-09-23", "2027-10-11",
  "2027-11-03", "2027-11-23",
]);

export type CallReportTodayType = "weekday" | "weekend" | "holiday";

function jstParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: JST_TIME_ZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  return {
    date,
    hour: Number(get("hour")),
    firedAt: `${date}T${get("hour")}:${get("minute")}:${get("second")}+09:00`,
  };
}

export function isJapaneseHoliday(date: string) {
  return JAPAN_HOLIDAYS.has(date);
}

export function shouldDeliverAt(now: Date) {
  const parts = jstParts(now);
  const weekday = new Date(`${parts.date}T00:00:00Z`).getUTCDay();
  const todayType: CallReportTodayType = isJapaneseHoliday(parts.date)
    ? "holiday"
    : weekday === 0 || weekday === 6 ? "weekend" : "weekday";
  const startHour = todayType === "weekday" ? 15 : 11;
  const inWindow = parts.hour >= startHour && parts.hour <= 21;
  return {
    deliver: inWindow,
    reason: inWindow ? null : "out_of_window" as const,
    todayType,
    inWindow,
    date: parts.date,
    firedAt: parts.firedAt,
  };
}
