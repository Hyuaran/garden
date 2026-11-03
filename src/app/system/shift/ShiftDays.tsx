"use client";
import {
  ActionButton,
  formStyles,
} from "@/app/system/forms/_components/form-kit";
import { useState } from "react";
import { hours, startOptions, weekend, type ShiftDay } from "@/lib/shift/rules";
export function shiftDate(date: string) {
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][
    new Date(date + "T00:00:00Z").getUTCDay()
  ];
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8))}(${weekday})`;
}

export default function ShiftDays({
  rows,
  onChange,
  disabled = false,
  holidays = [],
}: {
  rows: ShiftDay[];
  onChange: (rows: ShiftDay[]) => void;
  disabled?: boolean;
  holidays?: string[];
}) {
  const [weekdayStart, setWeekdayStart] = useState("14:00"),
    [holidayStart, setHolidayStart] = useState("10:00");
  const update = (date: string, value: string | null) =>
    onChange(
      rows.map((r) => (r.work_date === date ? { ...r, start_time: value } : r)),
    );
  return (
    <div>
      <div className={formStyles.shiftDays}>
        {rows.map((r) => (
          <div
            className={[
              formStyles.shiftDay,
              weekend(r.work_date) ? formStyles.shiftWeekend : "",
              holidays.includes(r.work_date) ? formStyles.shiftClosed : "",
            ].join(" ")}
            key={r.work_date}
          >
            <span>{shiftDate(r.work_date)}</span>
            {holidays.includes(r.work_date) ? (
              <span>定休日</span>
            ) : (
              <select
                aria-label={shiftDate(r.work_date) + "のシフト"}
                disabled={disabled}
                value={r.start_time?.slice(0, 5) || ""}
                onChange={(e) => update(r.work_date, e.target.value || null)}
              >
                <option value="">休み</option>
                {startOptions(r.work_date).map((time) => (
                  <option key={time} value={time}>
                    {time}〜21:00
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>
      <p>
        出勤{" "}
        {
          rows.filter((r) => r.start_time && !holidays.includes(r.work_date))
            .length
        }
        日・合計{" "}
        {rows.reduce(
          (n, r) =>
            n + (holidays.includes(r.work_date) ? 0 : hours(r.start_time)),
          0,
        )}{" "}
        時間
      </p>
      <div className={formStyles.shiftBulk}>
        <label>
          平日{" "}
          <select
            disabled={disabled}
            aria-label="まとめて設定する平日の開始"
            value={weekdayStart}
            onChange={(e) => setWeekdayStart(e.target.value)}
          >
            {startOptions("2026-11-04").map((t) => (
              <option key={t} value={t}>
                {t}〜21:00
              </option>
            ))}
          </select>
        </label>{" "}
        <label>
          土日祝{" "}
          <select
            disabled={disabled}
            aria-label="まとめて設定する土日祝の開始"
            value={holidayStart}
            onChange={(e) => setHolidayStart(e.target.value)}
          >
            {startOptions("2026-11-03").map((t) => (
              <option key={t} value={t}>
                {t}〜21:00
              </option>
            ))}
          </select>
        </label>
        <ActionButton
          disabled={disabled}
          onClick={() =>
            onChange(
              rows.map((r) => ({
                ...r,
                start_time: holidays.includes(r.work_date)
                  ? null
                  : weekend(r.work_date)
                    ? holidayStart
                    : weekdayStart,
              })),
            )
          }
        >
          全部の日に入力する
        </ActionButton>
      </div>
    </div>
  );
}
