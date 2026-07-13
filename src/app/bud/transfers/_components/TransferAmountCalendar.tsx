"use client";

import { useEffect, useMemo, useState } from "react";

import { supabase } from "../../_lib/supabase";

type CalendarTransferRow = {
  scheduled_date: string | null;
  amount: number | null;
  status: string | null;
};

type DailyAmount = {
  completedAmount: number;
  completedCount: number;
  pendingAmount: number;
  pendingCount: number;
};

const FETCH_RANGE_END = 4_999;
const FETCH_BATCH_SIZE = 1_000;
const PENDING_STATUSES = new Set(["承認待ち", "下書き"]);
const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];

async function fetchCalendarRows() {
  const rows: CalendarTransferRow[] = [];
  for (let from = 0; from <= FETCH_RANGE_END; from += FETCH_BATCH_SIZE) {
    const to = Math.min(from + FETCH_BATCH_SIZE - 1, FETCH_RANGE_END);
    const result = await supabase
      .from("bud_transfers")
      .select("scheduled_date,amount,status")
      .order("scheduled_date", { ascending: true })
      .range(from, to);
    if (result.error) return { rows: [], error: result.error };
    const batch = (result.data ?? []) as unknown as CalendarTransferRow[];
    rows.push(...batch);
    if (batch.length < FETCH_BATCH_SIZE) break;
  }
  return { rows, error: null };
}

export function TransferAmountCalendar() {
  const [rows, setRows] = useState<CalendarTransferRow[]>([]);
  const [month, setMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      const result = await fetchCalendarRows();
      if (result.error) {
        setRows([]);
        setError(result.error.message);
      } else {
        setRows(result.rows);
      }
      setLoading(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const dailyAmounts = useMemo(() => aggregateDailyAmounts(rows), [rows]);
  const days = useMemo(() => buildCalendarDays(month), [month]);
  const monthPrefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const monthTotals = useMemo(() => {
    let completedAmount = 0;
    let pendingAmount = 0;
    let completedCount = 0;
    let pendingCount = 0;
    dailyAmounts.forEach((value, key) => {
      if (!key.startsWith(monthPrefix)) return;
      completedAmount += value.completedAmount;
      completedCount += value.completedCount;
      pendingAmount += value.pendingAmount;
      pendingCount += value.pendingCount;
    });
    return { completedAmount, completedCount, pendingAmount, pendingCount };
  }, [dailyAmounts, monthPrefix]);

  const goToToday = () => {
    const today = new Date();
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  return (
    <section className="ceo-card trf-amount-calendar">
      <div className="trf-calendar-head">
        <div>
          <h2 className="trf-amount-title">振込カレンダー</h2>
          <p className="trf-amount-description">
            振込完了の実績と、承認待ち・下書きの予定を予定日ごとに集計しています。
          </p>
        </div>
        <div className="trf-amount-summary-row">
          <span className="trf-amount-summary">
            支払済み {monthTotals.completedCount}件・¥
            {monthTotals.completedAmount.toLocaleString("ja-JP")}
          </span>
          <span className="trf-amount-summary trf-amount-summary-planned">
            支払予定 {monthTotals.pendingCount}件・¥
            {monthTotals.pendingAmount.toLocaleString("ja-JP")}
          </span>
        </div>
      </div>

      <div className="trf-calendar-head trf-amount-month-head">
        <h3 className="trf-amount-month-title">
          {month.getFullYear()}年 {month.getMonth() + 1}月
        </h3>
        <div className="trf-calendar-nav">
          <button
            type="button"
            aria-label="前月"
            onClick={() =>
              setMonth(
                (current) =>
                  new Date(current.getFullYear(), current.getMonth() - 1, 1),
              )
            }
            className="trf-cal-btn"
          >
            ‹ 前月
          </button>
          <button
            type="button"
            onClick={goToToday}
            className="trf-cal-today"
          >
            今日
          </button>
          <button
            type="button"
            aria-label="翌月"
            onClick={() =>
              setMonth(
                (current) =>
                  new Date(current.getFullYear(), current.getMonth() + 1, 1),
              )
            }
            className="trf-cal-btn"
          >
            翌月 ›
          </button>
        </div>
      </div>

      {error && (
        <div className="trf-amount-message trf-amount-error">
          {error}
        </div>
      )}

      <div className="trf-calendar">
        <div className="trf-cal-row trf-cal-head">
          {WEEKDAYS.map((weekday, index) => (
            <div
              key={weekday}
              className={`trf-cal-cell ${
                index === 5
                  ? "trf-day-sat"
                  : index === 6
                    ? "trf-day-sun"
                    : ""
              }`}
            >
              {weekday}
            </div>
          ))}
        </div>
        {loading ? (
          <div className="trf-amount-message">
            金額を集計しています…
          </div>
        ) : (
          <div className="trf-amount-day-grid">
            {days.map((date) => {
              const key = formatDateKey(date);
              const amounts = dailyAmounts.get(key);
              const inMonth = date.getMonth() === month.getMonth();
              const isToday = key === formatDateKey(new Date());
              const isSunday = date.getDay() === 0;
              const isSaturday = date.getDay() === 6;
              return (
                <div
                  key={key}
                  data-date={key}
                  className={`trf-cal-cell trf-amount-day ${
                    inMonth ? "" : "trf-cal-other"
                  } ${isToday ? "trf-cal-today" : ""} ${
                    isSunday ? "trf-day-sun" : ""
                  } ${isSaturday ? "trf-day-sat" : ""}`}
                >
                  <span className="trf-amount-day-number">
                    {date.getDate()}
                  </span>
                  {amounts && amounts.completedAmount > 0 && (
                    <span className="trf-cal-badge trf-amount-badge">
                      <strong className="trf-amount-badge-value">
                        ¥{amounts.completedAmount.toLocaleString("ja-JP")}
                      </strong>
                      <span className="trf-amount-badge-count">
                        {amounts.completedCount}件
                      </span>
                    </span>
                  )}
                  {amounts && amounts.pendingAmount > 0 && (
                    <span className="trf-cal-badge trf-cal-badge-gold trf-amount-badge">
                      <strong className="trf-amount-badge-value">
                        ¥{amounts.pendingAmount.toLocaleString("ja-JP")}
                      </strong>
                      <span className="trf-amount-badge-count">
                        {amounts.pendingCount}件
                      </span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export function aggregateDailyAmounts(rows: CalendarTransferRow[]) {
  const dailyAmounts = new Map<string, DailyAmount>();
  rows.forEach((row) => {
    if (!row.scheduled_date) return;
    const current = dailyAmounts.get(row.scheduled_date) ?? {
      completedAmount: 0,
      completedCount: 0,
      pendingAmount: 0,
      pendingCount: 0,
    };
    const amount = Number(row.amount ?? 0);
    if (row.status === "振込完了") {
      current.completedAmount += amount;
      current.completedCount += 1;
    } else if (PENDING_STATUSES.has(row.status ?? "")) {
      current.pendingAmount += amount;
      current.pendingCount += 1;
    }
    dailyAmounts.set(row.scheduled_date, current);
  });
  return dailyAmounts;
}

function buildCalendarDays(month: Date) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(
    month.getFullYear(),
    month.getMonth(),
    1 - mondayOffset,
  );
  return Array.from(
    { length: 42 },
    (_, index) =>
      new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + index,
      ),
  );
}

function formatDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
