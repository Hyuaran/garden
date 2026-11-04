"use client";
import { useRef, useState } from "react";
import Modal from "@/app/system/_components/Modal/Modal";
import { SubmitButton } from "@/app/system/forms/_components/form-kit";
import { halfHourTimes, patternReady, type DefaultPattern } from "@/lib/shift/rules";
import { shiftMode, type ShiftEmployee, type ShiftSubmitterSetting } from "@/lib/shift/eligibility";

const weekdayLabels = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日", "", "祝日"];

export default function DefaultPatternSettings({ employees, settings, patterns, onChanged, onBusy, change }: {
  employees: ShiftEmployee[];
  settings: ShiftSubmitterSetting[];
  patterns: (DefaultPattern & { employee_id: string })[];
  onChanged: () => void;
  onBusy: (busy: boolean) => void;
  change: (id: string, mode: ShiftSubmitterSetting["mode"] | null) => Promise<void>;
}) {
  const [person, setPerson] = useState<ShiftEmployee | null>(null);
  const [draft, setDraft] = useState<DefaultPattern[]>([]);
  const [saved, setSaved] = useState(patterns);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const pending = useRef(false);
  const people = employees.filter(p => shiftMode(p, settings) === "default");
  function open(employee: ShiftEmployee) {
    setPerson(employee);
    setDraft([0, 1, 2, 3, 4, 5, 6, 8].map(weekday => {
      const row = saved.find(row => row.employee_id === employee.employee_id && row.weekday === weekday);
      return { weekday, start_time: row?.start_time?.slice(0, 5) ?? null, end_time: row?.end_time?.slice(0, 5) ?? null };
    }));
  }
  async function save() {
    if (!person || pending.current) return;
    pending.current = true;
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      const response = await fetch("/api/system/shift/submitters", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: person.employee_id, pattern: draft }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setSaved(previous => [...previous.filter(row => row.employee_id !== person.employee_id),
        ...draft.map(row => ({ ...row, employee_id: person.employee_id }))]);
      setPerson(null);
      onChanged();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
      onBusy(false);
    }
  }
  return <section aria-label="既定の勤務で提出する人">
    <h3>既定の勤務で提出する人（{people.length}人）</h3>
    <p>2026年12月分から提出します。曜日ごとと祝日の勤務を設定してください。</p>
    {error && <p role="alert">{error}</p>}
    <button type="button" disabled={busy} onClick={() => setAdding(value => !value)}>＋ 既定の勤務で提出する人を追加</button>
    {adding && <select aria-label="既定の勤務で提出する人を追加" value="" disabled={busy}
      onChange={event => {
        if (event.target.value) {
          setAdding(false);
          void change(event.target.value, "default");
        }
      }}>
      <option value="">＋ 既定の勤務で提出する人を追加</option>
      {employees.filter(p => !people.includes(p)).map(p => <option key={p.employee_id} value={p.employee_id}>{p.name}</option>)}
    </select>}
    <ul>{people.map(p => <li key={p.employee_id}>
      <button type="button" disabled={busy} onClick={() => open(p)}>{p.name}</button>　
      {!patternReady(saved.filter(row => row.employee_id === p.employee_id)) && <span>未設定　</span>}
      <button type="button" disabled={busy} onClick={() => void change(p.employee_id, "exclude")}>外す</button>
    </li>)}</ul>
    {person && <Modal title={`${person.name}さんの既定の勤務`} onClose={() => { if (!busy) setPerson(null); }}
      actions={<SubmitButton busy={busy} onClick={() => void save()}>保存する</SubmitButton>}>
      {draft.map(row => <p key={row.weekday}>
        {weekdayLabels[row.weekday]}　
        <select aria-label={`${weekdayLabels[row.weekday]}の開始`} value={row.start_time ?? ""} disabled={busy}
          onChange={event => setDraft(previous => previous.map(day => day.weekday === row.weekday
            ? { ...day, start_time: event.target.value || null, end_time: event.target.value ? day.end_time ?? "18:00" : null } : day))}>
          <option value="">休み</option>
          {halfHourTimes.map(time => <option key={time}>{time}</option>)}
        </select>〜
        <select aria-label={`${weekdayLabels[row.weekday]}の終了`} value={row.end_time ?? ""} disabled={busy || !row.start_time}
          onChange={event => setDraft(previous => previous.map(day => day.weekday === row.weekday ? { ...day, end_time: event.target.value } : day))}>
          <option value="">休み</option>
          {[...halfHourTimes, "24:00"].map(time => <option key={time}>{time}</option>)}
        </select>
      </p>)}
    </Modal>}
  </section>;
}
