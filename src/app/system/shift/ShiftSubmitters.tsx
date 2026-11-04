"use client";

import { useEffect, useRef, useState } from "react";
import ViewerPicker from "@/app/bud/_components/ViewerPicker/ViewerPicker";
import RowActionButton from "../_components/RowActionButton/RowActionButton";
import { isShiftEligible, type ShiftEmployee, type ShiftSubmitterSetting } from "@/lib/shift/eligibility";
import styles from "./shift-submitters.module.css";
import DefaultPatternSettings from "./DefaultPatternSettings";
import type { DefaultOption, DefaultPattern } from "@/lib/shift/rules";

type Data = {
  employees: (ShiftEmployee & { name_kana?: string | null })[];
  settings: ShiftSubmitterSetting[];
  options?: (DefaultOption & { employee_id: string })[];
  patterns?: (DefaultPattern & { employee_id: string })[];
};

export default function ShiftSubmitters({ onChanged, onBusy }: {
  onChanged: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/system/shift/submitters", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setData(result);
      })
      .catch(error => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, []);

  async function change(
    employee_id: string,
    mode: ShiftSubmitterSetting["mode"] | null,
  ) {
    if (!data || pending.current) return;
    pending.current = true;
    const previous = data;
    setBusy(true);
    onBusy(true);
    setError("");
    setData({ ...data, settings: [
      ...data.settings.filter(row => row.employee_id !== employee_id),
      ...(mode ? [{ employee_id, mode }] : []),
    ] });
    setPicking(false);
    try {
      const response = await fetch("/api/system/shift/submitters", {
        method: mode ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id, mode }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      onChanged();
    } catch (error) {
      setData(previous);
      setError(error instanceof Error ? error.message : "保存できませんでした。");
    } finally {
      pending.current = false;
      setBusy(false);
      onBusy(false);
    }
  }

  const people = data?.employees.filter(employee => isShiftEligible(employee, data.settings)) ?? [];
  const excluded = data?.employees.filter(employee =>
    data.settings.some(row => row.employee_id === employee.employee_id && row.mode === "exclude")) ?? [];
  return <section className={styles.section} aria-label="シフトを提出する人">
    <h3>シフトを提出する人{data && `（${people.length}人）`}</h3>
    <p>決まり：アルバイト・ブロードバンド事業・チームあり</p>
    {error && <p role="alert">{error}</p>}
    {!data ? !error && <p role="status">読み込み中…</p> : <>
      <button type="button" disabled={busy} onClick={() => setPicking(value => !value)}>＋ 提出する人を追加</button>
      {picking && <ViewerPicker
        employees={data.employees.filter(employee => !people.includes(employee)).map(employee => ({
          ...employee, name_kana: employee.name_kana ?? null,
        }))}
        value={[]}
        disabled={busy}
        onChange={ids => {
          const employee = data.employees.find(person => person.employee_id === ids[0]);
          if (employee) {
            void change(employee.employee_id, isShiftEligible(employee) ? null : "include");
          }
        }}
      />}
      <ul className={styles.people}>
        {people.map(employee => <li key={employee.employee_id}>
          <span>{employee.name}</span>
          <small>{employee.current_team || "所属なし"}</small>
          <small>{data.settings.some(row => row.employee_id === employee.employee_id && row.mode === "include") ? "追加" : "決まり"}</small>
          <RowActionButton kind="delete" label={`${employee.name}を提出する人から外す`} disabled={busy}
            onClick={() => void change(employee.employee_id,
              data.settings.some(row => row.employee_id === employee.employee_id && row.mode === "include") ? null : "exclude")} />
        </li>)}
      </ul>
      <DefaultPatternSettings
        employees={data.employees}
        settings={data.settings}
        patterns={data.patterns ?? []}
        options={data.options ?? []}
        onChanged={onChanged}
        onBusy={onBusy}
        change={change}
      />
      {excluded.length > 0 && <>
        <h3>提出しない人に設定した人</h3>
        <ul className={styles.people}>{excluded.map(employee => <li key={employee.employee_id}>
          <span>{employee.name}</span>
          <small>{employee.current_team || "所属なし"}</small>
          <button
            type="button"
            disabled={busy}
            onClick={() => void change(employee.employee_id, null)}
          >
            元に戻す
          </button>
        </li>)}</ul>
      </>}
    </>}
  </section>;
}
