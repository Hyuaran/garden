"use client";
import { useState } from "react";
import BoxSelect from "@/app/system/_components/BoxSelect/BoxSelect";
import { Button } from "../_components/Button";
import { colors } from "../_constants/colors";
type Option = { code: string; name: string };
type Registration = { code: string; divisionCode: string; typeCode: string; divisions: Option[]; workingTypes: Option[] };
export default function KotEmployeePanel({ employeeId, name }: { employeeId: string; name: string }) {
  const [current, setCurrent] = useState<Registration | null>(null);
  const [division, setDivision] = useState("");
  const [type, setType] = useState("");
  const [date, setDate] = useState(() => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date()));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState(false);
  const url = `/api/root/employees/${encodeURIComponent(employeeId)}/kot`;
  async function load() {
    setBusy(true); setMessage(""); setConfirm(false); setCurrent(null);
    try {
      const response = await fetch(url, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setCurrent(data); setDivision(data.divisionCode); setType(data.typeCode);
    } catch (error) { setMessage(error instanceof Error ? error.message : "読み込めませんでした"); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!current) return;
    setBusy(true); setConfirm(false); setMessage("");
    try {
      const response = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ updateDate: date, ...(division !== current.divisionCode ? { divisionCode: division } : {}), ...(type !== current.typeCode ? { typeCode: type } : {}) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage("KOT に反映しました"); setCurrent(null);
    } catch (error) { setMessage(error instanceof Error ? error.message : "反映できませんでした"); setCurrent(null); }
    finally { setBusy(false); }
  }
  const label = (options: Option[], code: string) => options.find(o => o.code === code)?.name ?? code;
  const changes = current ? [division !== current.divisionCode ? `所属を ${label(current.divisions, current.divisionCode)} → ${label(current.divisions, division)}` : "", type !== current.typeCode ? `雇用区分を ${label(current.workingTypes, current.typeCode)} → ${label(current.workingTypes, type)}` : ""].filter(Boolean) : [];
  return <section style={{ marginTop: 16, padding: 16, border: `1px solid ${colors.border}`, borderRadius: 6 }}>
    <h3 style={{ marginTop: 0 }}>KOT の登録内容</h3>
    {current && <p>KOT の従業員コード {current.code}</p>}
    <Button type="button" disabled={busy} onClick={load}>KOT から読み直す</Button>
    {current && <fieldset disabled={busy} style={{ border: 0, padding: 0, marginTop: 12 }}>
      <p>現在の所属：{label(current.divisions, current.divisionCode)} ／ 雇用区分：{label(current.workingTypes, current.typeCode)}</p>
      <BoxSelect label="変更後の所属" multiple={false} value={[division]} options={current.divisions.map(o => ({ value: o.code, label: o.name }))} onChange={v => { setDivision(v[0]); setConfirm(false); }} />
      <BoxSelect label="変更後の雇用区分" multiple={false} value={[type]} options={current.workingTypes.map(o => ({ value: o.code, label: o.name }))} onChange={v => { setType(v[0]); setConfirm(false); }} />
      <label>いつから <input type="date" value={date} onChange={e => { setDate(e.target.value); setConfirm(false); }} />（所属・雇用区分の変更が効く日）</label>
      <div style={{ marginTop: 12 }}><Button type="button" disabled={busy || !changes.length || !date} onClick={() => setConfirm(true)}>KOT に反映する</Button></div>
      {confirm && <div role="alertdialog" aria-label="KOT の変更確認"><p>{name}さん（{current.code}）の{changes.join("、")}に変えます（{date} から）</p><Button type="button" disabled={busy} onClick={save}>反映する</Button> <Button type="button" onClick={() => setConfirm(false)}>やめる</Button></div>}
    </fieldset>}
    {message && <p role="status">{message}</p>}
  </section>;
}