"use client";
import ReorderGrip from "@/app/system/_components/ReorderGrip/ReorderGrip";
import { visibleAccounts } from "@/lib/bud/mf/balances";
import Link from "next/link";
import { cardSummaries, validTransactionPeriod } from "@/lib/bud/mf/transactions";
import UpdatedStamp, { UpdatedStampRow } from "@/app/system/_components/UpdatedStamp/UpdatedStamp";
import { formatSyncStamp } from "@/app/system/_components/UpdatedStamp/formatSyncStamp";
import SystemTabs, { TabActionButton } from "@/app/system/_components/SystemTabs/SystemTabs";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import { accountDisplayName } from "@/lib/bud/mf/corporations";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GroupViewers, ArrivalTotals, AxisOrder, BalanceSnapshot, CardTransaction, Employee, MfAccount } from "@/lib/bud/mf/types";
import BalanceMatrix from "./BalanceMatrix";
import LinkAlerts from "./LinkAlerts";
import type { LinkAlert } from "@/lib/bud/mf/link-alerts";
import PeriodSelect from "./PeriodSelect";
import styles from "./bank.module.css";

type Snapshot = { employeeId?: string; groupViewers?: GroupViewers[]; yearsByAccount?: Record<string, number[]>; arrivalTotal?: ArrivalTotals; axes?: AxisOrder[]; snapshots?: BalanceSnapshot[]; accounts: MfAccount[]; transactions: CardTransaction[]; employees: Employee[]; admin: boolean };
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
function People({ employees, selected, inherited = [], onChange }: { employees: Employee[]; selected: string[]; inherited?: string[]; onChange: (ids: string[]) => void }) {
  const [search, setSearch] = useState("");
  const normalize = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0)-0x60));
  const checked = (id: string) => selected.includes(id) || inherited.includes(id);
  const people = employees.filter(p => checked(p.employee_id) || normalize((p.name ?? "") + " " + (p.name_kana ?? "")).includes(normalize(search.trim()))).sort((a,b) => Number(checked(b.employee_id))-Number(checked(a.employee_id)));
  return <fieldset><legend>閲覧権限</legend><label className={styles.peopleSearch}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></svg><input aria-label="名前で探す" placeholder="名前で探す" value={search} onChange={e => setSearch(e.target.value)} /></label><div className={styles.people}>{people.map(person => <label key={person.employee_id} className={inherited.includes(person.employee_id) ? styles.inheritedViewer : undefined}><input type="checkbox" checked={checked(person.employee_id)} disabled={inherited.includes(person.employee_id)} onChange={e => onChange(e.target.checked ? [...selected, person.employee_id] : selected.filter(id => id !== person.employee_id))} /><span title={person.name ?? person.employee_id}>{person.name ?? person.employee_id}{inherited.includes(person.employee_id) && <small>すべての口座で閲覧可</small>}</span></label>)}</div></fieldset>;
}
function GroupSettings({ kind, viewers, employees, onSave, onClose }: { kind: "bank" | "card"; viewers: string[]; employees: Employee[]; onSave: () => Promise<void>; onClose: () => void }) {
  const [selected, setSelected] = useState(viewers.filter(id => employees.some(p => p.employee_id === id)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return <form className={styles.settings} aria-label={kind === "bank" ? "銀行すべての閲覧権限" : "カードすべての閲覧権限"} onSubmit={async e => {
    e.preventDefault(); setSaving(true); setError("");
    try { await api("/api/bud/mf-accounts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "group-viewers", kind, viewers: selected }) }); await onSave(); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : "保存できませんでした"); } finally { setSaving(false); }
  }}><h2>{kind === "bank" ? "銀行すべての閲覧権限" : "カードすべての閲覧権限"}</h2><p>ここに入れた人は、今ある口座と、これから増える口座をすべて見られます</p><People employees={employees} selected={selected} onChange={setSelected} />{error && <p role="alert">{error}</p>}<div className={styles.toolbar}><button disabled={saving} type="submit">{saving ? "保存中…" : "保存"}</button><button type="button" disabled={saving} onClick={onClose}>閉じる</button></div></form>;
}
function Settings({ account, employees, inherited, onSave, onClose }: { account: MfAccount; employees: Employee[]; inherited: string[]; onSave: () => Promise<void>; onClose: () => void }) {
  const [draft, setDraft] = useState({ ...account, visible_employee_ids: account.visible_employee_ids.filter(id => employees.some(p => p.employee_id === id)) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return <form className={styles.settings} aria-label={`${accountDisplayName(account.name)}の設定`} onSubmit={async e => {
    e.preventDefault(); setSaving(true); setError("");
    try {
      await api("/api/bud/mf-accounts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "settings", id: draft.mf_account_id, viewers: draft.visible_employee_ids, hidden: draft.hidden, mail_alias: draft.mail_alias ?? "", book: draft.book_sub_account_name, mode: draft.balance_mode, note: draft.balance_note, anchor_balance: draft.anchor_balance ?? null, anchor_at: draft.anchor_at ?? null, anchor_date: draft.anchor_date ?? null }) });
      await onSave(); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "保存できませんでした"); } finally { setSaving(false); }
  }}>
    <h2>{accountDisplayName(account.name)}</h2>
    <People employees={employees} selected={draft.visible_employee_ids} inherited={inherited} onChange={ids => setDraft({ ...draft, visible_employee_ids: ids })} />
    {account.kind === "bank" && <label>マネーフォワードの知らせメールでの名前<input value={draft.mail_alias ?? ""} maxLength={500} onChange={e => setDraft({ ...draft, mail_alias: e.target.value })} /></label>}
    <label><input type="checkbox" checked={draft.hidden} onChange={e => setDraft({ ...draft, hidden: e.target.checked })} />この{account.kind === "bank" ? "口座" : "カード"}を表示しない</label>
    {account.kind === "bank" && <>
      <label>帳簿の補助科目名<input value={draft.book_sub_account_name} maxLength={500} onChange={e => setDraft({ ...draft, book_sub_account_name: e.target.value })} /><small>帳簿に科目がない場合は空欄にしてください。</small></label>
      <label>残高の出し方<select value={draft.balance_mode} onChange={e => setDraft({ ...draft, balance_mode: e.target.value as MfAccount["balance_mode"] })}><option value="arrival">届いた入出金で動かす（おすすめ）</option><option value="auto">計算した残高を表示</option><option value="anchor">銀行の残高を基準にする</option><option value="manual_check">残高は マネーフォワードで確認</option></select></label>
      {(draft.balance_mode === "anchor" || draft.balance_mode === "arrival") && <>
        {draft.balance_note.startsWith("起点を自動で設定") && <small>{draft.balance_note}</small>}
        <label>起点の残高（円）<input type="number" step="1" value={draft.anchor_balance ?? ""} onChange={e => setDraft({ ...draft, anchor_balance: e.target.value === "" ? null : Number(e.target.value) })} /></label>
        {draft.balance_mode === "arrival" && <label>起点の時刻（日本時間）<input type="datetime-local" step="1" required value={draft.anchor_at ? new Date(Date.parse(draft.anchor_at) + 9 * 3600000).toISOString().slice(0,19) : ""} onChange={e => setDraft({ ...draft, anchor_at: e.target.value ? new Date(e.target.value + "+09:00").toISOString() : null })} /><small>マネーフォワードの残高に合わせ直すときは、確認した金額と時刻を手で入力してください。</small></label>}
        {draft.balance_mode === "anchor" && <label>起点の日<input type="date" value={draft.anchor_date ?? ""} onChange={e => setDraft({ ...draft, anchor_date: e.target.value || null })} /></label>}
      </>}
      <label>マネーフォワードで確認する理由<input value={draft.balance_note} maxLength={1000} onChange={e => setDraft({ ...draft, balance_note: e.target.value })} /></label>
      <small>補助科目名・残高の出し方・起点を変更したあとは、読み直してください。</small>
    </>}
    {error && <p role="alert">{error}</p>}
    <div className={styles.toolbar}><button disabled={saving} type="submit">{saving ? "保存中…" : "保存"}</button><button type="button" disabled={saving} onClick={onClose}>閉じる</button></div>
  </form>;
}
export default function BankAccounts() {
  const [linkAlerts, setLinkAlerts] = useState<LinkAlert[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot>({ accounts: [], transactions: [], employees: [], admin: false });
  const [tab, setTab] = useState("bank");
  const [period, setPeriod] = useState("current");
  const card = "";
  useEffect(() => { const params = new URLSearchParams(window.location.search); if (params.get("tab") === "card") setTab("card"); const initial = params.get("period"); if (initial && validTransactionPeriod(initial)) setPeriod(initial); }, []);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [settings, setSettings] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [saveCount, setSaveCount] = useState(0);
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
  const permitted = snapshot.employeeId ? visibleAccounts(snapshot.accounts, snapshot.employeeId, snapshot.admin, snapshot.groupViewers) : snapshot.accounts;
  const shown = permitted.filter(a => a.kind === tab && (!a.hidden || settings || reordering));

  const times = snapshot.accounts.filter(a => !a.hidden).map(a => a.fetched_at).sort();
  const selectedAccount = snapshot.accounts.find(a => a.mf_account_id === selected);
  const cards = permitted.filter(a => a.kind === "card" && !a.hidden);

  return <div className={styles.pageShell}>
    <header className={styles.header}><SystemBreadcrumb root={{ label: "Bud", href: "/bud/dashboard" }} items={[{ label: "口座残高・カード利用" }]} /><h1>口座残高・カード利用</h1><UpdatedStampRow><UpdatedStamp label="マネーフォワード" date={times[0]} emptyText="未読み込み" busy={refreshing || loading} disabled={saveCount > 0} refreshLabel="読み直す" title="マネーフォワードに届いている分を読み直す（銀行からの取り直しは マネーフォワードの［一括更新］）" onRefresh={async () => {
      setRefreshing(true); setError("");
      try { await api("/api/bud/mf-accounts/refresh", { method: "POST" }); await load(); }
      catch(e) { setError(e instanceof Error ? e.message : "読み込めませんでした"); }
      finally { setRefreshing(false); }
    }} ><span className={styles.mfRetrieve}><a href="https://accounting.moneyforward.com/accounts" target="_blank" rel="noopener noreferrer">マネーフォワードで再取得<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M14 3h7v7M21 3 10 14M10 3H3v18h18v-7" /></svg></a><span role="tooltip">マネーフォワードの画面を開きます。［一括更新］で銀行から取り直したあと、↻ で Garden に読み込みます</span></span></UpdatedStamp></UpdatedStampRow></header>
    <div className={styles.tabToolbar}><SystemTabs aria-label="表示内容" actions={snapshot.admin ? <><TabActionButton icon="sort" label={reordering ? "並び替えを終える" : "並び替え"} pressed={reordering} disabled={refreshing} onClick={() => setReordering(!reordering)} /><TabActionButton icon="settings" label={settings ? "設定を終える" : "設定"} pressed={settings} disabled={refreshing} onClick={() => { setSettings(!settings); setSelected(null); }} /></> : undefined}>{[["bank","口座残高"],["card","カード利用"]].map(([value,label]) => <button role="tab" id={`tab-${value}`} aria-controls={`panel-${value}`} key={value} aria-selected={tab === value} onClick={() => { setTab(value); setSelected(null); }}>{label}</button>)}</SystemTabs>
      <small role="status">{saveCount > 0 ? "並び順を保存中…" : loading ? "読み込み中…" : ""}</small>
    </div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {selectedAccount && settings && snapshot.admin && <Settings key={selectedAccount.mf_account_id} account={selectedAccount} inherited={snapshot.groupViewers?.find(g => g.kind === selectedAccount.kind)?.employee_ids ?? []} employees={snapshot.employees} onSave={load} onClose={() => setSelected(null)} />}
    <section role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
      {settings && snapshot.admin && <article className={styles.account}><h2>{tab === "bank" ? "銀行すべての閲覧権限" : "カードすべての閲覧権限"}<TabActionButton icon="settings" label={tab === "bank" ? "銀行すべての閲覧権限の設定" : "カードすべての閲覧権限の設定"} onClick={() => setSelected("group")} /></h2>{selected === "group" && <GroupSettings key={tab} kind={tab as "bank" | "card"} viewers={snapshot.groupViewers?.find(g => g.kind === tab)?.employee_ids ?? []} employees={snapshot.employees} onSave={load} onClose={() => setSelected(null)} />}</article>}
      {!settings && tab === "bank" && <LinkAlerts accounts={permitted} onChange={setLinkAlerts} />}
      {!settings && tab === "bank" && <BalanceMatrix linkAlerts={linkAlerts} arrivalTotal={snapshot.arrivalTotal} accounts={permitted} axes={snapshot.axes} snapshots={snapshot.snapshots} reordering={reordering && snapshot.admin} onError={setError} />}
      {(settings || (tab === "card" && reordering)) && <div className={styles.grid}>{shown.map((account) => <article key={account.mf_account_id} data-account={account.mf_account_id} className={styles.account}>
        <h2>{reordering && tab === "card" && <ReorderGrip label={accountDisplayName(account.name)} itemKey={account.mf_account_id} keys={shown.map(a=>a.mf_account_id)} selector="article[data-account]" attribute="data-account" onMove={move} />}{accountDisplayName(account.name)}{settings && <TabActionButton icon="settings" label={`${accountDisplayName(account.name)}の設定`} onClick={() => setSelected(account.mf_account_id)} />}</h2>
        {account.hidden && <small>表示しない設定</small>}
        <small>{account.sub_account_label}</small>


      </article>)}</div>}
      {!loading && shown.length === 0 && <p>表示できる{tab === "bank" ? "口座" : "カード"}はありません。</p>}
      {!settings && tab === "card" && <><div className={styles.toolbar}><PeriodSelect value={period} onChange={value => { setPeriod(value); const url = new URL(window.location.href); url.searchParams.set("period", value); window.history.replaceState(null, "", url); }} fiscalStart={snapshot.accounts.find(a => a.fiscal_start_date)?.fiscal_start_date} years={Object.values(snapshot.yearsByAccount ?? {}).flat()} /></div><div className={styles.grid}>{cardSummaries(cards, snapshot.transactions).map(({ account, amount, count, latest }) => <Link className={styles.account} key={account.mf_account_id} href={`/bud/bank/accounts/${encodeURIComponent(account.mf_account_id)}?period=${encodeURIComponent(period)}`}><h2>{accountDisplayName(account.name)}</h2><strong className={styles.amount}>{yen(amount)}</strong><small>{count} 件{latest ? `・最後 ${latest}` : ""}</small></Link>)}</div></>}
    </section>
  </div>;
}
