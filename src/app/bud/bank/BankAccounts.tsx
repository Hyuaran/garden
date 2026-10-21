"use client";
import Link from "next/link";
import { cardSummaries, fiscalYearLabel } from "@/lib/bud/mf/transactions";
import UpdatedStamp, { UpdatedStampRow } from "@/app/system/_components/UpdatedStamp/UpdatedStamp";
import { formatSyncStamp } from "@/app/system/_components/UpdatedStamp/formatSyncStamp";
import SystemTabs, { TabActionButton } from "@/app/system/_components/SystemTabs/SystemTabs";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import { accountDisplayName } from "@/lib/bud/mf/corporations";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ArrivalTotals, AxisOrder, BalanceSnapshot, CardTransaction, Employee, MfAccount } from "@/lib/bud/mf/types";
import BalanceMatrix from "./BalanceMatrix";
import styles from "./bank.module.css";

type Snapshot = { arrivalTotal?: ArrivalTotals; axes?: AxisOrder[]; snapshots?: BalanceSnapshot[]; accounts: MfAccount[]; transactions: CardTransaction[]; employees: Employee[]; admin: boolean };
export const formatLoadedAt = formatSyncStamp;
const yen = (value: number) => `${value.toLocaleString("ja-JP")} 円`;
async function api(url: string, init?: RequestInit) {
  const fallback = "読み込めませんでした。時間をおいてもう一度お試しください。続くときは管理者へお問い合わせください。";
  let response: Response;
  let data;
  try {
    response = await fetch(url, { ...init, cache: "no-store" });
    data = await response.json();
  } catch { throw new Error(fallback); }
  if (!response.ok) throw new Error(data.error ?? fallback);
  return data;
}
function Arrow({ down = false }: { down?: boolean }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" style={down ? { transform: "rotate(180deg)" } : undefined}><path d="M12 20V4m-6 6 6-6 6 6" /></svg>;
}
function Settings({ account, employees, onSave, onClose }: { account: MfAccount; employees: Employee[]; onSave: () => Promise<void>; onClose: () => void }) {
  const [draft, setDraft] = useState(account);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return <form className={styles.settings} aria-label={`${accountDisplayName(account.name)}の設定`} onSubmit={async e => {
    e.preventDefault(); setSaving(true); setError("");
    try {
      await api("/api/bud/mf-accounts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "settings", id: draft.mf_account_id, viewers: draft.visible_employee_ids, hidden: draft.hidden, book: draft.book_sub_account_name, mode: draft.balance_mode, note: draft.balance_note, anchor_balance: draft.anchor_balance ?? null, anchor_at: draft.anchor_at ?? null, anchor_date: draft.anchor_date ?? null }) });
      await onSave(); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "保存できませんでした"); } finally { setSaving(false); }
  }}>
    <h2>{accountDisplayName(account.name)}の設定</h2>
    <fieldset><legend>見てよい人</legend><div className={styles.people}>{employees.map(person => <label key={person.employee_id}><input type="checkbox" checked={draft.visible_employee_ids.includes(person.employee_id)} onChange={e => setDraft({ ...draft, visible_employee_ids: e.target.checked ? [...draft.visible_employee_ids, person.employee_id] : draft.visible_employee_ids.filter(id => id !== person.employee_id) })} />{person.name ?? person.employee_id}</label>)}</div></fieldset>
    <label><input type="checkbox" checked={draft.hidden} onChange={e => setDraft({ ...draft, hidden: e.target.checked })} />この{account.kind === "bank" ? "口座" : "カード"}を表示しない</label>
    {account.kind === "bank" && <>
      <label>帳簿の補助科目名<input value={draft.book_sub_account_name} maxLength={500} onChange={e => setDraft({ ...draft, book_sub_account_name: e.target.value })} /><small>帳簿に科目がない場合は空欄にしてください。</small></label>
      <label>残高の出し方<select value={draft.balance_mode} onChange={e => setDraft({ ...draft, balance_mode: e.target.value as MfAccount["balance_mode"] })}><option value="arrival">届いた入出金で動かす（おすすめ）</option><option value="auto">計算した残高を表示</option><option value="anchor">銀行の残高を基準にする</option><option value="manual_check">残高は MF で確認</option></select></label>
      {(draft.balance_mode === "anchor" || draft.balance_mode === "arrival") && <>
        <label>起点の残高（円）<input type="number" step="1" value={draft.anchor_balance ?? ""} onChange={e => setDraft({ ...draft, anchor_balance: e.target.value === "" ? null : Number(e.target.value) })} /></label>
        {draft.balance_mode === "arrival" && <label>起点の時刻（日本時間）<input type="datetime-local" step="1" required value={draft.anchor_at ? new Date(Date.parse(draft.anchor_at) + 9 * 3600000).toISOString().slice(0,19) : ""} onChange={e => setDraft({ ...draft, anchor_at: e.target.value ? new Date(e.target.value + "+09:00").toISOString() : null })} /><small>MF の残高に合わせ直すときは、確認した金額と時刻を手で入力してください。</small></label>}
        {draft.balance_mode === "anchor" && <label>起点の日<input type="date" value={draft.anchor_date ?? ""} onChange={e => setDraft({ ...draft, anchor_date: e.target.value || null })} /></label>}
      </>}
      <label>MF で確認する理由<input value={draft.balance_note} maxLength={1000} onChange={e => setDraft({ ...draft, balance_note: e.target.value })} /></label>
      <small>補助科目名・残高の出し方・起点を変更したあとは、読み直してください。</small>
    </>}
    {error && <p role="alert">{error}</p>}
    <div className={styles.toolbar}><button disabled={saving} type="submit">{saving ? "保存中…" : "保存"}</button><button type="button" disabled={saving} onClick={onClose}>閉じる</button></div>
  </form>;
}
export default function BankAccounts() {
  const [snapshot, setSnapshot] = useState<Snapshot>({ accounts: [], transactions: [], employees: [], admin: false });
  const [tab, setTab] = useState("bank");
  const [period, setPeriod] = useState("current");
  const card = "";
  useEffect(() => { if (new URLSearchParams(window.location.search).get("tab") === "card") setTab("card"); }, []);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [settings, setSettings] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [saveCount, setSaveCount] = useState(0);
  const drag = useRef<string | null>(null);
  const current = useRef(snapshot.accounts);
  const queue = useRef(Promise.resolve());
  const requestSequence = useRef(0);
  const load = useCallback(async () => {
    const seq = ++requestSequence.current;
    const data: Snapshot = await api(`/api/bud/mf-accounts?${new URLSearchParams({ period, card })}`);
    if (seq === requestSequence.current) { setSnapshot(data); current.current = data.accounts; }
  }, [period, card]);
  useEffect(() => { setLoading(true); load().catch(e => setError(e.message)).finally(() => setLoading(false)); }, [load]);
  const move = (id: string, target: string) => {
    if (id === target) return;
    const accounts = [...current.current];
    const from = accounts.findIndex(a => a.mf_account_id === id);
    const to = accounts.findIndex(a => a.mf_account_id === target);
    if (from < 0 || to < 0) return;
    accounts.splice(to, 0, accounts.splice(from,1)[0]);
    accounts.forEach((a,i) => { accounts[i] = { ...a, sort_order: i }; });
    current.current = accounts; setSnapshot(s => ({ ...s, accounts })); setSaveCount(n => n+1);
    queue.current = queue.current.then(async () => {
      try {
        await api("/api/bud/mf-accounts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reorder", ids: accounts.map(a => a.mf_account_id) }) });
      } catch (e) {
        setError(e instanceof Error ? e.message : "並び順を保存できませんでした");
        if (current.current.map(a => a.mf_account_id).join() === accounts.map(a => a.mf_account_id).join()) {
          try { await load(); } catch { /* Keep the last displayed snapshot and the save error. */ }
        }
      }
      finally { setSaveCount(n => n-1); }
    });
  };
  const shown = snapshot.accounts.filter(a => a.kind === tab && (!a.hidden || settings || reordering));

  const times = snapshot.accounts.filter(a => !a.hidden).map(a => a.fetched_at).sort();
  const selectedAccount = snapshot.accounts.find(a => a.mf_account_id === selected);
  const cards = snapshot.accounts.filter(a => a.kind === "card" && !a.hidden);

  return <div className={styles.pageShell}>
    <header className={styles.header}><SystemBreadcrumb root={{ label: "Bud", href: "/bud/dashboard" }} items={[{ label: "口座残高・カード利用" }]} /><h1>口座残高・カード利用</h1><UpdatedStampRow><UpdatedStamp label="MF" date={times[0]} emptyText="未読み込み" busy={refreshing || loading} disabled={saveCount > 0} refreshLabel="読み直す" title="読み直す（1分に1回まで）" onRefresh={async () => {
      setRefreshing(true); setError("");
      try { await api("/api/bud/mf-accounts/refresh", { method: "POST" }); await load(); }
      catch(e) { setError(e instanceof Error ? e.message : "読み込めませんでした"); }
      finally { setRefreshing(false); }
    }} /></UpdatedStampRow></header>
    <div className={styles.tabToolbar}><SystemTabs aria-label="表示内容" actions={snapshot.admin ? <><TabActionButton icon="sort" label={reordering ? "並び替えを終える" : "並び替え"} pressed={reordering} disabled={refreshing} onClick={() => setReordering(!reordering)} /><TabActionButton icon="settings" label={settings ? "設定を終える" : "設定"} pressed={settings} disabled={refreshing} onClick={() => { setSettings(!settings); setSelected(null); }} /></> : undefined}>{[["bank","口座残高"],["card","カード利用"]].map(([value,label]) => <button role="tab" id={`tab-${value}`} aria-controls={`panel-${value}`} key={value} aria-selected={tab === value} onClick={() => { setTab(value); setSelected(null); }}>{label}</button>)}</SystemTabs>
      <small role="status">{saveCount > 0 ? "並び順を保存中…" : loading ? "読み込み中…" : ""}</small>
    </div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {selectedAccount && settings && snapshot.admin && <Settings key={selectedAccount.mf_account_id} account={selectedAccount} employees={snapshot.employees} onSave={load} onClose={() => setSelected(null)} />}
    <section role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
      {tab === "bank" && <BalanceMatrix arrivalTotal={snapshot.arrivalTotal} accounts={snapshot.accounts} axes={snapshot.axes} snapshots={snapshot.snapshots} reordering={reordering && snapshot.admin} onError={setError} />}
      {(settings || (tab === "card" && reordering)) && <div className={styles.grid}>{shown.map((account,i) => <article key={account.mf_account_id} data-account={account.mf_account_id} className={styles.account} onDragOver={e => { if (reordering && tab === "card") e.preventDefault(); }} onDrop={e => { e.preventDefault(); if (reordering && tab === "card" && drag.current) move(drag.current, account.mf_account_id); drag.current = null; }}>
        <h2>{reordering && tab === "card" && <span className={styles.grip} draggable onDragStart={e => { drag.current = account.mf_account_id; e.dataTransfer.setData("text/plain",account.mf_account_id); }} onDragEnd={() => { drag.current = null; }} aria-label={`${accountDisplayName(account.name)}をつかんで移動`}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg></span>}{accountDisplayName(account.name)}</h2>
        {account.hidden && <small>表示しない設定</small>}
        <small>{account.sub_account_label}</small>

        {(reordering || settings) && <div className={styles.toolbar}>{reordering && tab === "card" && <><button aria-label={`${accountDisplayName(account.name)}を上へ`} disabled={i === 0} onClick={() => move(account.mf_account_id,shown[i-1].mf_account_id)}><Arrow /></button><button aria-label={`${accountDisplayName(account.name)}を下へ`} disabled={i === shown.length-1} onClick={() => move(account.mf_account_id,shown[i+1].mf_account_id)}><Arrow down /></button></>}{settings && <button onClick={() => setSelected(account.mf_account_id)}>{accountDisplayName(account.name)}の設定</button>}</div>}
      </article>)}</div>}
      {!loading && shown.length === 0 && <p>表示できる{tab === "bank" ? "口座" : "カード"}はありません。</p>}
      {tab === "card" && <><div className={styles.toolbar}><label>期間 <select value={period} onChange={e => setPeriod(e.target.value)}><option value="current">今月</option><option value="last">先月</option><option value="year">{fiscalYearLabel(snapshot.accounts.find(a => a.fiscal_start_date)?.fiscal_start_date)}</option></select></label></div><div className={styles.grid}>{cardSummaries(cards, snapshot.transactions).map(({ account, amount, count, latest }) => <Link className={styles.account} key={account.mf_account_id} href={`/bud/bank/accounts/${encodeURIComponent(account.mf_account_id)}?period=${period}`}><h2>{accountDisplayName(account.name)}</h2><strong className={styles.amount}>{yen(amount)}</strong><small>{count} 件{latest ? `・最後 ${latest}` : ""}</small></Link>)}</div></>}
    </section>
  </div>;
}
