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
    <section className="rounded-xl border border-amber-200 bg-[rgba(255,253,246,0.92)] p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="font-shippori text-xl font-semibold tracking-wide text-amber-950">
            日別金額カレンダー
          </h2>
          <p className="mt-1 text-xs leading-6 text-amber-800">
            振込完了の実績と、承認待ち・下書きの予定を予定日ごとに集計しています。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-medium text-emerald-800">
            動いた金額 {monthTotals.completedCount}件・¥
            {monthTotals.completedAmount.toLocaleString("ja-JP")}
          </span>
          <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 font-medium text-orange-800">
            動く予定 {monthTotals.pendingCount}件・¥
            {monthTotals.pendingAmount.toLocaleString("ja-JP")}
          </span>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-shippori text-lg font-semibold text-amber-950">
          {month.getFullYear()}年 {month.getMonth() + 1}月
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="前月"
            onClick={() =>
              setMonth(
                (current) =>
                  new Date(current.getFullYear(), current.getMonth() - 1, 1),
              )
            }
            className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-sm text-amber-900 hover:bg-amber-50"
          >
            ‹ 前月
          </button>
          <button
            type="button"
            onClick={goToToday}
            className="rounded-full bg-amber-500 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-amber-600"
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
            className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-sm text-amber-900 hover:bg-amber-50"
          >
            翌月 ›
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-amber-100 bg-white/80">
        <div className="grid grid-cols-7 border-b border-amber-100 bg-amber-50/80">
          {WEEKDAYS.map((weekday, index) => (
            <div
              key={weekday}
              className={`px-2 py-2 text-center text-xs font-medium ${
                index >= 5 ? "text-rose-700" : "text-amber-900"
              }`}
            >
              {weekday}
            </div>
          ))}
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-amber-800">
            金額を集計しています…
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {days.map((date) => {
              const key = formatDateKey(date);
              const amounts = dailyAmounts.get(key);
              const inMonth = date.getMonth() === month.getMonth();
              const isToday = key === formatDateKey(new Date());
              return (
                <div
                  key={key}
                  data-date={key}
                  className={`min-h-28 border-b border-r border-amber-100 p-2 ${
                    inMonth ? "bg-white/70" : "bg-stone-50/60 text-stone-400"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span
                      className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-sm ${
                        isToday
                          ? "bg-amber-500 font-semibold text-white"
                          : inMonth
                            ? "text-amber-950"
                            : "text-stone-400"
                      }`}
                    >
                      {date.getDate()}
                    </span>
                  </div>
                  {amounts && amounts.completedAmount > 0 && (
                    <div className="mb-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-emerald-900">
                      <div className="text-[10px] font-medium">動いた金額</div>
                      <div className="text-sm font-semibold tabular-nums">
                        ¥{amounts.completedAmount.toLocaleString("ja-JP")}
                      </div>
                      <div className="text-[10px]">{amounts.completedCount}件</div>
                    </div>
                  )}
                  {amounts && amounts.pendingAmount > 0 && (
                    <div className="rounded-md border border-orange-200 bg-orange-50 px-2 py-1.5 text-orange-900">
                      <div className="text-[10px] font-medium">動く予定</div>
                      <div className="text-sm font-semibold tabular-nums">
                        ¥{amounts.pendingAmount.toLocaleString("ja-JP")}
                      </div>
                      <div className="text-[10px]">{amounts.pendingCount}件</div>
                    </div>
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
