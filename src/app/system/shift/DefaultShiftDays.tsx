"use client";
import { formStyles } from "@/app/system/forms/_components/form-kit";
import { halfHourTimes, hours, type ShiftDay } from "@/lib/shift/rules";
import { shiftDate } from "./ShiftDays";

export default function DefaultShiftDays({
  rows,
  defaults = [],
  onChange,
  disabled,
  manager = false,
}: {
  rows: ShiftDay[];
  defaults?: ShiftDay[];
  onChange: (rows: ShiftDay[]) => void;
  disabled?: boolean;
  manager?: boolean;
}) {
  function update(date: string, changes: Partial<ShiftDay>) {
    onChange(rows.map(row => row.work_date === date ? { ...row, ...changes } : row));
  }
  return (
    <div>
    <div className={formStyles.shiftDays}>
      {rows.map(row => {
        const base = defaults.find(day => day.work_date === row.work_date);
        const kind = row.day_kind ?? (row.start_time ? "work" : "rest");
        return (
          <div key={row.work_date} className={formStyles.shiftDay}>
          <span>{shiftDate(row.work_date)}</span>
          <select
            aria-label={shiftDate(row.work_date) + "のシフト"}
            disabled={disabled}
            value={kind}
            onChange={event => {
              const day_kind = event.target.value as "work" | "rest" | "paid";
              update(row.work_date, {
                day_kind,
                start_time: day_kind === "work" ? base?.start_time ?? "09:00" : null,
                end_time: day_kind === "work" ? base?.end_time ?? "18:00" : null,
              });
            }}
          >
            {(manager || base?.start_time || (disabled && row.start_time)) && (
              <option value="work">
                {manager ? "勤務" : disabled
                  ? `${row.start_time}〜${row.end_time}`
                  : `${base?.start_time ?? row.start_time}〜${base?.end_time ?? row.end_time}`}
              </option>
            )}
            <option value="rest">休み</option>
            <option value="paid">有給</option>
          </select>
          {manager && kind === "work" && (
            <>
            <select
              aria-label={shiftDate(row.work_date) + "の開始"}
              disabled={disabled}
              value={row.start_time ?? "09:00"}
              onChange={event => update(row.work_date, { start_time: event.target.value })}
            >
              {halfHourTimes.map(time => <option key={time}>{time}</option>)}
            </select>
            <select
              aria-label={shiftDate(row.work_date) + "の終了"}
              disabled={disabled}
              value={row.end_time ?? "18:00"}
              onChange={event => update(row.work_date, { end_time: event.target.value })}
            >
              {[...halfHourTimes, "24:00"].map(time => <option key={time}>{time}</option>)}
            </select>
            </>
          )}
          </div>
        );
      })}
    </div>
    <p>
      出勤 {rows.filter(row => row.start_time).length}日・合計 {rows.reduce(
        (total, row) => total + hours(row.start_time, row.end_time ?? "21:00"), 0,
      )} 時間・有給 {rows.filter(row => row.day_kind === "paid").length}日
    </p>
    </div>
  );
}
