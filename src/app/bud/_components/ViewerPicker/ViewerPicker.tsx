"use client";
import { useState } from "react";
import styles from "./ViewerPicker.module.css";
export type ViewerEmployee = { employee_id: string; name: string; name_kana: string | null };
const normalize = (s: string) => s.normalize("NFKC").replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)).replace(/\s/g, "").toLowerCase();
// 口座・カードの「閲覧権限」と同じ見た目と動き：虫眼鏡つきの検索・チェック済みは検索中も残して先頭に
export default function ViewerPicker({ employees, value, onChange, disabled = false }: { employees: ViewerEmployee[]; value: string[]; onChange: (value: string[]) => void; disabled?: boolean }) {
  const [search, setSearch] = useState("");
  const query = normalize(search);
  const people = employees.filter(e => value.includes(e.employee_id) || normalize(e.name).includes(query) || normalize(e.name_kana ?? "").includes(query)).sort((a,b) => Number(value.includes(b.employee_id)) - Number(value.includes(a.employee_id)) || a.name.localeCompare(b.name, "ja"));
  return <div>
    <label className={styles.peopleSearch}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></svg><input aria-label="名前で探す" placeholder="名前で探す" value={search} onChange={e => setSearch(e.target.value)} /></label>
    <div className={styles.people}>{people.map(e => <label key={e.employee_id}><input type="checkbox" checked={value.includes(e.employee_id)} disabled={disabled} onChange={event => onChange(event.target.checked ? [...value,e.employee_id] : value.filter(id => id !== e.employee_id))} /><span title={e.name}>{e.name}</span></label>)}</div>
  </div>;
}
