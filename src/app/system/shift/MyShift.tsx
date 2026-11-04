"use client";
import { useEffect, useState, useRef } from "react";
import DoneOverlay from "@/app/system/_components/DoneOverlay/DoneOverlay";
import {
  RadioGroup,
  SubmitButton,
  ResultMessage,
} from "@/app/system/forms/_components/form-kit";
import {
  closedMessage,
  deadline,
  monthDays,
  stamp,
  type ShiftDay,
} from "@/lib/shift/rules";
import ShiftDays from "./ShiftDays";
import DefaultShiftDays from "./DefaultShiftDays";

export type MyData = {
  eligible: boolean;
  mode?: "telema" | "default";
  message?: string;
  defaults?: ShiftDay[];
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
export default function MyShift({
  endpoint = "/api/system/shift/my",
  token,
  initial,
}: {
  endpoint?: string;
  token?: string;
  initial?: MyData;
}) {
  const pending = useRef(false);
  const shown = useRef(Boolean(initial));
  const [{ current, next }] = useState(shiftMonths),
    [month, setMonth] = useState(next),
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
    void fetch(endpoint + "?month=" + month, {
      headers: token ? { Authorization: "Bearer " + token } : {},
      cache: "no-store",
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "読み込めませんでした。");
        if (active) {
          setData(d);
          setNote(d.submissions?.[0]?.note || "");
          setRows(
            monthDays(month).map((work_date) => ({
              ...(month === current || d.confirmation ? d.confirmed : d.wish)
                ?.find((r: ShiftDay) => r.work_date === work_date),
              work_date,
              end_time: d.mode === "default" ? (month === current || d.confirmation ? d.confirmed : d.wish)
                ?.find((r: ShiftDay) => r.work_date === work_date)?.end_time?.slice(0, 5) ?? null : undefined,
              start_time:
                (month === current || d.confirmation ? d.confirmed : d.wish)
                  ?.find((r: ShiftDay) => r.work_date === work_date)
                  ?.start_time?.slice(0, 5) || null,
            })),
          );
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [endpoint, token, month, current]);
  async function submit() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(endpoint + "?month=" + month, {
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
        <p role="status">読み込み中です…</p>
      </section>
    );
  shown.current = true;
  const labels = [
    `${Number(next.slice(5))}月のシフト`,
    `${Number(current.slice(5))}月のシフト`,
  ];
  const fixed = month === current || Boolean(data?.confirmation);
  return (
    <section style={{ minHeight: 560 }}>
      <h2>自分のシフト</h2>
      <RadioGroup
        name="shift-month"
        label="表示する月"
        options={labels}
        value={labels[month === next ? 0 : 1]}
        onChange={(v) => {
          if (!pending.current) setMonth(v === labels[0] ? next : current);
        }}
      />
      <ResultMessage>{error}</ResultMessage>
      {!data ? (
        <p role="status" aria-busy="true">
          読み込み中です…
        </p>
      ) : data.message ? <p>{data.message}</p> : (
        <>
          {!fixed ? (
            <p>
              提出の締切：{stamp(deadline(month))}　状態：
              {data.submissions?.[0]
                ? "提出済み（" + stamp(data.submissions[0].submitted_at) + "）"
                : "未提出"}
            </p>
          ) : (
            <p>
              {data.confirmation
                ? "確定：" + stamp(data.confirmation.confirmed_at)
                : "この月のシフトはまだ確定していません。"}
            </p>
          )}
          {!fixed && !data.editable && <p>{closedMessage}</p>}
          {(!fixed || data.confirmation) && (
            data.mode === "default" ? <DefaultShiftDays
              rows={rows}
              defaults={data.defaults}
              onChange={setRows}
              disabled={busy || fixed || !data.editable}
            /> : <ShiftDays
              rows={rows}
              onChange={setRows}
              disabled={busy || fixed || !data.editable}
              holidays={data.holidays}
            />
          )}
          <label style={{ display: "block" }}>
            備考
            <textarea
              aria-label="備考"
              value={note}
              maxLength={500}
              readOnly={fixed || !data.editable}
              disabled={busy}
              style={{ display: "block", width: "100%", fontSize: 16 }}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
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
