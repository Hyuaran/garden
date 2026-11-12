"use client";

import { useRef, useState, type ReactNode } from "react";
import { validMyNumber } from "@/lib/my-number/validation";
import styles from "../onboarding.module.css";

export default function DependentAdminField({ employeeId, index, field, value, display, onSaved }: {
  employeeId: string; index: number; field: "annual_income" | "occupation" | "my_number";
  value: string; display: ReactNode; onSaved: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const lock = useRef(false);
  const number = field === "my_number";
  const label = number ? "マイナンバー" : field === "annual_income" ? "年間収入" : "職業または学校と学年";

  async function save() {
    if (lock.current) return;
    if (number && !validMyNumber(draft)) { setMessage("正しい12桁のマイナンバーを入力してください。"); return; }
    if (number && value && !overwrite) { setMessage("上書きする場合は、確認にチェックを入れてください。"); return; }
    lock.current = true; setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/system/onboarding/admin/${encodeURIComponent(employeeId)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dependent", index, field, value: draft, overwrite }),
      });
      // 送信後は番号の入力値を保持しない。再試行時も入れ直す。
      if (number) setDraft("");
      const body = await response.json();
      if (!response.ok) { setMessage(body.error || "保存できませんでした。"); return; }
      onSaved(body.value); setDraft(""); setEditing(false); setOverwrite(false); setMessage("保存しました。");
    } catch { setMessage("保存できませんでした。もう一度お試しください。"); }
    finally { if (number) setDraft(""); lock.current = false; setBusy(false); }
  }

  return <span className={styles.emailReviewValue} data-clarity-mask={number ? "true" : undefined}>
    {editing ? <>
      {number && <span className={styles.hint}>税と社会保険の手続きに使います。保存後は下4桁だけを表示します。</span>}
      <input aria-label={`扶養家族${index + 1}人目の${label}`} type={number ? "password" : "text"}
        inputMode={number || field === "annual_income" ? "numeric" : "text"} autoComplete="off"
        maxLength={number ? 12 : 2000} value={draft} disabled={busy} onChange={event => { setDraft(event.target.value); setMessage(""); }} />
      {number && value && <label><input type="checkbox" checked={overwrite} disabled={busy} onChange={event => setOverwrite(event.target.checked)} />保存済みのマイナンバーを上書きします</label>}
      <button type="button" aria-label={`扶養家族${index + 1}人目の${label}を保存`} disabled={busy} onClick={() => void save()}>保存</button>
      <button type="button" disabled={busy} onClick={() => { setDraft(""); setEditing(false); setMessage(""); setOverwrite(false); }}>やめる</button>
    </> : <>
      {display}
      <button type="button" aria-label={`扶養家族${index + 1}人目の${label}を${number && !value ? "入れる" : "修正"}`} onClick={() => { setDraft(number ? "" : value); setEditing(true); setMessage(""); setOverwrite(false); }}>{number && !value ? "マイナンバーを入れる" : "修正"}</button>
    </>}
    {message && <span role="status" className={styles.saveStatus}>{message}</span>}
  </span>;
}
