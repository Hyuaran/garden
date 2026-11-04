"use client";
import { useEffect, useState, useRef } from "react";
import DoneOverlay from "@/app/system/_components/DoneOverlay/DoneOverlay";
import {
  RadioGroup,
  SubmitButton,
  ResultMessage,
  TextArea,
} from "@/app/system/forms/_components/form-kit";
import {
  closedMessage,
  deadline,
  monthDays,
  stamp,
  type ShiftDay,
  type DefaultOption,
} from "@/lib/shift/rules";
import ShiftDays from "./ShiftDays";
import DefaultShiftDays from "./DefaultShiftDays";

export type MyData = {
  eligible: boolean;
  submit_months?: { month: string; editable: boolean }[];
  confirmed_months?: { month: string }[];
  mode?: "telema" | "default";
  message?: string;
  defaults?: ShiftDay[];
  options?: DefaultOption[];
  wish?: ShiftDay[];
  confirmed?: ShiftDay[];
  submissions?: { submitted_at: string; note?: string | null }[];
  holidays?: string[];
  editable?: boolean;
  confirmation?: { confirmed_at: string; confirmed_by_name: string } | null;
};
export function shiftMonths() {
  const current = new Date()
    .toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" })
    .slice(0, 7);
  const d = new Date(current + "-01T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 1);
  return { current, next: d.toISOString().slice(0, 7) };
}
function MyShiftPanel({
  endpoint = "/api/system/shift/my",
  token,
  initial,
  title,
  view,
}: {
  view: "mine" | "confirmed";
  endpoint?: string;
  token?: string;
  initial?: MyData;
  /** タブや画面の見出しが無い入口だけ渡す */
  title?: string;
}) {
  const pending = useRef(false);
  const shown = useRef(Boolean(initial));
  const [month, setMonth] = useState(""),
    [data, setData] = useState<MyData | null>(initial || null),
    [rows, setRows] = useState<ShiftDay[]>([]),
    [note, setNote] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    const requestedMonth = month || new Date()
      .toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" })
      .slice(0, 7);
    const query = new URLSearchParams({ view, month: requestedMonth });
    void fetch(endpoint + "?" + query, {
      headers: token ? { Authorization: "Bearer " + token } : {},
      cache: "no-store",
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "読み込めませんでした。");
        if (active) {
          const available = view === "confirmed" ? d.confirmed_months : d.submit_months;
          const selected = available?.some((row: { month: string }) => row.month === month);
          if (available?.length && !selected) {
            setMonth(available[0].month);
            return;
          }
          setData(d);
          setNote(d.submissions?.[0]?.note || "");
          if (!month || !selected) {
            setRows([]);
            return;
          }
          const source: ShiftDay[] = (view === "confirmed" ? d.confirmed : d.wish) || [];
          setRows(monthDays(month).map(work_date => {
            const row = source.find(day => day.work_date === work_date);
            return {
              ...row,
              work_date,
              start_time: row?.start_time?.slice(0, 5) || null,
              end_time: d.mode === "default"
                ? row?.end_time?.slice(0, 5) ?? null : undefined,
            };
          }));
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [endpoint, token, month, view]);
  async function submit() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(endpoint + "?view=" + view + "&month=" + month, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: "Bearer " + token } : {}),
        },
        body: JSON.stringify({ rows, note }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "提出できませんでした。");
      setData(d);
      setDone(true);
      setTimeout(() => setDone(false), 1200);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  if (data?.eligible === false) return <p>シフトの提出はありません。</p>;
  // 対象の人か分かるまで、カレンダーや月の選択を仮に描かない（描き直しでちらつくため）。
  if (!data && !shown.current)
    return (
      <section style={{ minHeight: 560 }} aria-busy="true">
        {error ? <ResultMessage>{error}</ResultMessage> : <p role="status">読み込み中です…</p>}
      </section>
    );
  shown.current = true;
  const months = (view === "confirmed"
    ? data?.confirmed_months : data?.submit_months) || [];
  const labels = months.map(row => `${Number(row.month.slice(5))}月のシフト`);
  const fixed = view === "confirmed";
  return (
    <section style={{ minHeight: 560 }}>
      {title && <h2>{title}</h2>}
      {months.length > 1 && (
        <RadioGroup
          name="shift-month"
          label="表示する月"
          options={labels}
          value={labels[months.findIndex(row => row.month === month)]}
          onChange={(v) => {
            if (!pending.current) {
              setData(null);
              setMonth(months[labels.indexOf(v)].month);
            }
          }}
        />
      )}
      <ResultMessage>{error}</ResultMessage>
      {!data ? (
        <p role="status" aria-busy="true">
          読み込み中です…
        </p>
      ) : months.length === 0 ? (
        <p>{fixed ? "確定したシフトはまだありません。" : "提出するシフトはありません。"}</p>
      ) : data.message && !fixed ? <p>{data.message}</p> : (
        <>
          {!fixed ? (
            <p>
              提出の締切：{stamp(deadline(month))}　状態：
              {data.submissions?.[0]
                ? "提出済み（" + stamp(data.submissions[0].submitted_at) + "）"
                : "未提出"}
            </p>
          ) : data.confirmation?.confirmed_at ? (
            <p>{"確定：" + stamp(data.confirmation.confirmed_at)}</p>
          ) : null}
          {!fixed && !data.editable && <p>{closedMessage}</p>}
          {data.mode === "default" ? (
            <DefaultShiftDays
              options={data.options}
              rows={rows}
              defaults={data.defaults}
              onChange={setRows}
              disabled={busy || fixed || !data.editable}
            />
          ) : (
            <ShiftDays
              rows={rows}
              onChange={setRows}
              disabled={busy || fixed || !data.editable}
              holidays={data.holidays}
            />
          )}
          {!fixed && (
            <label style={{ display: "block" }}>
              備考
              <TextArea
                aria-label="備考"
                value={note}
                maxLength={500}
                readOnly={fixed || !data.editable}
                disabled={busy}
                rows={3}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
          )}
          {!fixed && data.editable && data.mode !== "default" && (
            <p>18:30 以降の開始を希望する場合は、ここに記入してください。</p>
          )}
          {!fixed && data.editable && data.mode === "default" && (
            <p>ほかの時間を希望する場合は、備考に記入してください。</p>
          )}
          {!fixed && (
            <SubmitButton
              busy={busy}
              disabled={!data.editable}
              onClick={() => void submit()}
            >
              提出する
            </SubmitButton>
          )}
        </>
      )}
      {done && <DoneOverlay title="提出しました" />}
    </section>
  );
}

export default function MyShift(props: {
  endpoint?: string;
  token?: string;
  initial?: MyData;
  title?: string;
  view?: "mine" | "confirmed";
}) {
  const [selection, setSelection] = useState("提出");
  const view = props.view || (selection === "提出" ? "mine" : "confirmed");
  return (
    <>
      {!props.view && (
        <RadioGroup
          name="shift-view"
          label="表示するシフト"
          options={["提出", "確定"]}
          value={selection}
          onChange={setSelection}
        />
      )}
      <MyShiftPanel key={view} {...props} view={view} />
    </>
  );
}
