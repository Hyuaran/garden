"use client";
import type { ReactNode } from "react";
import { formStyles } from "@/app/system/forms/_components/form-kit";

const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];

/** 月曜を先頭にしたときの列の位置（月曜＝0） */
function mondayOffset(date: string) {
  return (new Date(date + "T00:00:00Z").getUTCDay() + 6) % 7;
}

/** カレンダーのマスの日付。広い幅は日だけ、狭い幅は月と曜日つきに切り替える（CSS）。 */
export function ShiftDayLabel({ date, longLabel }: { date: string; longLabel: string }) {
  return (
    <span>
      <span className={formStyles.shiftDayShort}>{Number(date.slice(8))}</span>
      <span className={formStyles.shiftDayLong}>{longLabel}</span>
    </span>
  );
}

/** 月曜始まりのカレンダーの枠。幅が足りないときは、曜日の見出しを隠して一覧の形にする。 */
export default function ShiftCalendar({
  firstDate,
  wide = false,
  children,
}: {
  firstDate?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  const blanks = firstDate ? mondayOffset(firstDate) : 0;
  const title = firstDate
    ? `${firstDate.slice(0, 4)}年${Number(firstDate.slice(5, 7))}月`
    : "";
  return (
    <div className={`${formStyles.shiftCalendar} ${wide ? formStyles.shiftCalendarWide : ""}`}>
      {title && <p className={formStyles.shiftMonthTitle}>{title}</p>}
      <div className={formStyles.shiftDays}>
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className={formStyles.shiftWeekHead} aria-hidden="true">
            {weekday}
          </div>
        ))}
        {Array.from({ length: blanks }, (_, index) => (
          <div key={index} className={formStyles.shiftBlank} aria-hidden="true" />
        ))}
        {children}
      </div>
    </div>
  );
}
