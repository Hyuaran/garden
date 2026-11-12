"use client";

import { useEffect, useState } from "react";
import Modal from "@/app/system/_components/Modal/Modal";
import { ADMIN_SELECT_OPTIONS, emptyAdminInput, type AdminInput } from "../_lib/onboarding-admin";
import { TEMPLATE_FIELDS, templateOverwrites, templatePatch, type AdminTemplate, type TemplateValues } from "../_lib/onboarding-admin-templates";
import styles from "../onboarding.module.css";

const labels = { office: "所属店舗", weekly_hours: "週の所定労働時間", health_insurance: "健康保険", pension_insurance: "厚生年金", employment_insurance: "雇用保険", tax_class: "税区分", salary_kind: "給与の区分", base_salary: "基本給（円）", commute_cap_monthly: "交通費の上限（1か月・円）" };
async function request(method = "GET", body?: AdminTemplate) {
  const response = await fetch("/api/system/onboarding/admin-templates", { method, cache: "no-store", ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "ひな形を読み込めませんでした");
  return data;
}

export default function AdminTemplates({ current, canWrite, isSuperAdmin, disabled, onApply }: {
  current: AdminInput; canWrite: boolean; isSuperAdmin: boolean; disabled: boolean; onApply: (values: TemplateValues) => void;
}) {
  const [templates, setTemplates] = useState<AdminTemplate[]>([]);
  const [editing, setEditing] = useState<AdminTemplate | null>(null);
  const [pending, setPending] = useState<AdminTemplate | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!canWrite) return;
    let active = true;
    request().then(data => {
      if (!Array.isArray(data)) throw new Error("ひな形を読み込めませんでした");
      if (active) setTemplates(data);
    }).catch(error => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, [canWrite]);
  if (!canWrite) return null;

  function apply(template: AdminTemplate) {
    const patch = templatePatch(template.values);
    if (!Object.keys(patch).length) { setMessage("このひな形の値はまだ登録されていません。"); return; }
    onApply(patch);
    setPending(null);
    setMessage("ひな形を入れました。内容を確かめて［保存］を押してください。");
  }
  async function save() {
    if (!editing || !isSuperAdmin || busy) return;
    setBusy(true); setMessage("");
    try {
      const updated: AdminTemplate = await request("PATCH", editing);
      setTemplates(rows => rows.map(row => row.id === updated.id ? updated : row).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)));
      setEditing(null);
    } catch (error) { setMessage(error instanceof Error ? error.message : "保存できませんでした"); }
    finally { setBusy(false); }
  }
  const editValues = { ...emptyAdminInput(), ...editing?.values };
  return <div>
    <div className={styles.actions}>{templates.map(template => <span key={template.id}>
      <button type="button" disabled={disabled || busy} onClick={() => templateOverwrites(current, template.values) ? setPending(template) : apply(template)}>{template.name}</button>
      {isSuperAdmin && <button type="button" aria-label={`${template.name}のひな形を変更`} disabled={disabled || busy} onClick={() => { setMessage(""); setEditing(structuredClone(template)); }}>変更</button>}
    </span>)}</div>
    {message && <p role="status">{message}</p>}
    {pending && <Modal title="ひな形の上書き確認" size="sm" onClose={() => setPending(null)} actions={<>
      <button type="button" onClick={() => setPending(null)}>やめる</button>
      <button type="button" disabled={disabled} onClick={() => apply(pending)}>ひな形を入れる</button>
    </>}><p>入力済みの欄を「{pending.name}」の値で上書きします。よろしいですか。</p></Modal>}
    {editing && isSuperAdmin && <Modal title="ひな形の変更" onClose={() => { if (!busy) setEditing(null); }} actions={<button type="button" disabled={busy} onClick={() => void save()}>保存</button>}>
      <fieldset disabled={busy} className={styles.adminFields}>
        <label className={styles.field}>名前<input value={editing.name} maxLength={100} onChange={event => setEditing({ ...editing, name: event.target.value })} /></label>
        <label className={styles.field}>並び順<input type="number" value={editing.sort_order} onChange={event => setEditing({ ...editing, sort_order: Number(event.target.value) })} /></label>
        {TEMPLATE_FIELDS.filter(key => key !== "allowances").map(key => {
          const options = key.endsWith("insurance") ? ADMIN_SELECT_OPTIONS.insurance : key === "tax_class" ? ADMIN_SELECT_OPTIONS.taxClass : key === "salary_kind" ? ADMIN_SELECT_OPTIONS.salaryKind : null;
          const change = (value: string) => setEditing({ ...editing, values: { ...editing.values, [key]: value } });
          return <label className={styles.field} key={key}>{labels[key as keyof typeof labels]}{options ? <select value={editValues[key] as string} onChange={event => change(event.target.value)}><option value="">未設定</option>{options.map(option => <option key={option}>{option}</option>)}</select> : <input value={editValues[key] as string} maxLength={2000} onChange={event => change(event.target.value)} />}</label>;
        })}
        <div className={styles.allowanceBlock}><h3>手当</h3>
          {editValues.allowances.map((allowance, index) => <div className={styles.allowanceRow} key={index}>
            <label className={styles.field}>名前<input value={allowance.name} onChange={event => setEditing({ ...editing, values: { ...editing.values, allowances: editValues.allowances.map((row, i) => i === index ? { ...row, name: event.target.value } : row) } })} /></label>
            <label className={styles.field}>金額（円）<input value={allowance.amount} onChange={event => setEditing({ ...editing, values: { ...editing.values, allowances: editValues.allowances.map((row, i) => i === index ? { ...row, amount: event.target.value } : row) } })} /></label>
            <button type="button" onClick={() => setEditing({ ...editing, values: { ...editing.values, allowances: editValues.allowances.filter((_, i) => i !== index) } })}>消す</button>
          </div>)}
          <button type="button" disabled={editValues.allowances.length >= 6} onClick={() => setEditing({ ...editing, values: { ...editing.values, allowances: [...editValues.allowances, { name: "", amount: "" }] } })}>手当を足す</button>
          <button type="button" onClick={() => setEditing({ ...editing, values: { ...editing.values, allowances: [] } })}>手当なし</button>
        </div>
      </fieldset>
      {message && <p role="alert">{message}</p>}
    </Modal>}
  </div>;
}
