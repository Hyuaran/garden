"use client";
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { SystemViewButton } from '@/app/system/_components/ViewPermissionButton/SystemViewContext';
import SystemTabs from '@/app/system/_components/SystemTabs/SystemTabs';
import SystemBreadcrumb from '@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb';
import DataTable, { type DataColumn } from '@/app/system/_components/DataTable/DataTable';
import { BUSINESSES, FORM_LABELS, PAYMENTS, PURPOSES, isExpenseForm, jstTimestamp, recentCombinations, validateExpense, type ExpenseForm, type ExpenseReport } from './_lib/expense';
import styles from '../nhk-visit/nhk-visit.module.css';
import local from './expense.module.css';
const columns: DataColumn<ExpenseReport>[] = [
  { id: 'date', label: '決済日', type: 'date', value: r => r.paid_on },
  { id: 'business', label: '事業', type: 'text', value: r => r.business },
  { id: 'purpose', label: '用途', type: 'text', value: r => r.purpose },
  { id: 'detail', label: '詳細', type: 'text', value: r => r.purpose_detail, wrap: true },
  { id: 'amount', label: '金額', type: 'number', value: r => r.amount, render: r => `${r.amount.toLocaleString()} 円` },
  { id: 'created', label: '送った時刻', type: 'date', value: r => r.created_at, render: r => jstTimestamp(new Date(r.created_at)) },
];
// fixedForm＝スマホの入口（/m/expense/<種類>）。タブを出さず、その種類だけを開く
export default function ExpenseClient({ submitterName, employeeNumber, fixedForm }: { submitterName: string; employeeNumber: string; fixedForm?: ExpenseForm }) {
  const [form, setForm] = useState<ExpenseForm>('nhk');
  const [business, setBusiness] = useState('NHK');
  const [payment, setPayment] = useState('現金');
  const [paidOn, setPaidOn] = useState(() => jstTimestamp().slice(0, 10));
  const [amount, setAmount] = useState(''); const [purpose, setPurpose] = useState('');
  const [detail, setDetail] = useState(''); const [note, setNote] = useState('');
  const [reports, setReports] = useState<ExpenseReport[]>([]);
  const [older, setOlder] = useState<ExpenseReport[]>([]);
  const [status, setStatus] = useState(''); const [sending, setSending] = useState(false);
  const busy = useRef(false); const selected = useRef<ExpenseForm>('nhk'); const last = useRef<Partial<Record<ExpenseForm, string>>>({});
  function switchForm(next: ExpenseForm) {
    selected.current = next; setForm(next); setBusiness(next === 'nhk' ? 'NHK' : last.current[next] ?? '');
    if (fixedForm) return;
    const url = new URL(window.location.href); url.searchParams.set('form', next); window.history.replaceState(null, '', url);
    try { localStorage.setItem(`expense-form:${employeeNumber}`, next); } catch { /* Storage unavailable */ }
  }
  useEffect(() => {
    let active = true;
    let saved: string | null = null;
    try { saved = localStorage.getItem(`expense-form:${employeeNumber}`); } catch { /* Storage unavailable */ }
    const query = new URL(window.location.href).searchParams.get('form');
    switchForm(fixedForm ?? (isExpenseForm(query) ? query : isExpenseForm(saved) ? saved : 'nhk'));
    void fetch('/api/system/expense-report?recent=1', { cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error('history');
      const body = await response.json(); if (!active) return;
      const rows: ExpenseReport[] = body.reports ?? []; setReports(rows); setOlder(body.combinations ?? []);
      last.current = body.lastBusinesses ?? {};
      rows.forEach(row => { if (!last.current[row.form]) last.current[row.form] = row.business; });
      setBusiness(current => current || last.current[selected.current] || '');
    }).catch(() => { if (active) setStatus('最近の報告を読み込めませんでした。時間をおいて開き直してください。'); });
    return () => { active = false; };
    // This identity is a server-provided string, never an inline parent object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeNumber]);
  const combinations = recentCombinations([...reports, ...older]);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy.current) return;
    const input = validateExpense({ form, business, payment, paid_on: paidOn, amount: /^\d+$/.test(amount) ? Number(amount) : NaN, purpose, purpose_detail: detail, note });
    if (!input) { setStatus('必須項目・金額・用途の詳細を確認してください'); return; }
    busy.current = true; setSending(true); setStatus('');
    try {
      const response = await fetch('/api/system/expense-report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
      const body = await response.json();
      if (!response.ok || !body.ok) { setStatus('送信できませんでした。入力内容を確認してください。'); return; }
      last.current[form] = business; setReports(rows => [body.report, ...rows]);
      setAmount(''); setDetail(''); setNote('');
      // Kintone に入らなかったときは本人にも分かるように出す（Garden には記録済み・管理者へは Garden通知で知らせる）
      setStatus(body.kintone_error ? 'Garden には記録しました。Kintone への登録に失敗したので、管理者が送り直します。' : '送信しました');
    } catch { setStatus('送信結果を確認できませんでした。最近の報告を確認してから再度お試しください。'); }
    finally { busy.current = false; setSending(false); }
  }

  return <main className={[styles.pageShell, local.pageShell, fixedForm ? `${styles.mobile} ${local.mobile}` : ''].join(' ')}>
    <header className={styles.header}>
      {!fixedForm && <SystemBreadcrumb items={[{ label: '業務管理ツール', href: '/system/forms' }, { label: '経費 報告' }]} />}
      <div className={styles.mobileTitleRow}><h1>{fixedForm ? '経費 報告（' + FORM_LABELS[fixedForm] + '）' : '経費 報告'}</h1>{fixedForm && <p className={styles.mobileSender} data-clarity-mask="true">{submitterName} さん</p>}</div>
    </header>
    {!fixedForm && <><SystemTabs aria-label="経費の種類" actions={<SystemViewButton />}>{(Object.keys(FORM_LABELS) as ExpenseForm[]).map(key => <button type="button" role="tab" aria-selected={form === key} disabled={sending} key={key} onClick={() => switchForm(key)}>{FORM_LABELS[key]}</button>)}</SystemTabs><p className={styles.sender} data-clarity-mask="true">送信者　{submitterName}（{employeeNumber}）</p></>}
    <form onSubmit={submit}><fieldset disabled={sending} className={local.fields}>
      {combinations.length > 0 && <div className={local.reuse}><label>よく使う入力から選ぶ<select value="" onChange={event => { if (event.target.value === '') return; const row = combinations[Number(event.target.value)]; if (row) { setPurpose(row.purpose); setDetail(row.purpose_detail); setAmount(String(row.amount)); } }}><option value="">選んでください</option>{combinations.map((row, index) => <option key={index} value={index}>{row.purpose}｜{row.purpose_detail}｜{row.amount.toLocaleString()} 円</option>)}</select></label><p>選ぶと、使用用途・用途の詳細・金額がまとめて入ります</p></div>}
      <section className={styles.panel}><h2>1 事業</h2>{form === 'nhk' ? <p className={styles.fixedText}>NHK</p> : form === 'ueda' ? <select aria-label="事業" required value={business} onChange={e => setBusiness(e.target.value)}><option value="">選んでください</option>{BUSINESSES.ueda.map(item => <option key={item}>{item}</option>)}</select> : <div role="radiogroup" aria-label="事業" className={local.choices}>{BUSINESSES[form].map(item => <label className="garden-radio" key={item}><input type="radio" name="business" required checked={business === item} onChange={() => setBusiness(item)} /><span>{item}</span></label>)}</div>}</section>
      <section className={styles.panel}><h2>2 決済方法</h2><div role="radiogroup" aria-label="決済方法" className={local.choices}>{PAYMENTS.map(item => <label className="garden-radio" key={item}><input type="radio" name="payment" checked={payment === item} onChange={() => setPayment(item)} /><span>{item}</span></label>)}</div></section>
      <section className={styles.panel}><h2><label htmlFor="expense-date">3 決済日</label></h2><input id="expense-date" aria-label="決済日" type="date" required value={paidOn} onChange={e => setPaidOn(e.target.value)} /></section>
      <section className={styles.panel}><h2><label htmlFor="expense-amount">4 金額</label></h2><div className={local.amount}><input id="expense-amount" aria-label="金額（円・税込）" inputMode="numeric" pattern="[0-9]+" required value={amount} onChange={e => setAmount(e.target.value)} /><span>円（税込）</span></div></section>
      <section className={styles.panel}><h2>5 使用用途</h2><div><div role="radiogroup" aria-label="使用用途" className={local.choices}>{PURPOSES.slice(0, 7).map(item => <label className="garden-radio" key={item}><input type="radio" name="purpose" checked={purpose === item} onChange={() => setPurpose(item)} /><span>{item}</span></label>)}</div><label>ほかの用途<select value={(PURPOSES.slice(7) as readonly string[]).includes(purpose) ? purpose : ''} onChange={e => setPurpose(e.target.value)}><option value="">選んでください</option>{PURPOSES.slice(7).map(item => <option key={item}>{item}</option>)}</select></label></div></section>
      <section className={styles.panel}><h2><label htmlFor="expense-detail">6 用途の詳細{purpose === 'その他' && '（必須）'}</label></h2><input id="expense-detail" aria-label={purpose === 'その他' ? '用途の詳細（必須）' : '用途の詳細'} placeholder="例：帰宅 新大宮-瓢箪山" required={purpose === 'その他'} value={detail} onChange={e => setDetail(e.target.value)} /></section>
      <section className={styles.panel}><h2><label htmlFor="expense-note">7 備考</label></h2><textarea id="expense-note" aria-label="備考" value={note} onChange={e => setNote(e.target.value)} /></section>
      <button className={styles.primary} type="submit" disabled={sending}>{sending ? '送信中...' : fixedForm ? '送信する' : '報告内容を送信する'}</button>
    </fieldset></form>
    {status && <p role="status" className={status === '送信しました' ? styles.message : styles.error}>{status}</p>}
    <section className={styles.history}><h2>自分の最近の報告（直近 1 週間）</h2>{fixedForm ? reports.length === 0 ? <p className={styles.empty}>まだありません</p> : <div className={styles.historyBox}>{reports.map(row => <p key={row.id}>{row.paid_on}　{row.business}　{row.purpose}　{row.purpose_detail}　{row.amount.toLocaleString()} 円　{jstTimestamp(new Date(row.created_at))}</p>)}</div> : <DataTable rows={reports} columns={columns} rowKey={row => row.id} searchText={row => [row.business, row.purpose, row.purpose_detail].join(" ")} defaultSort={{ id: 'created', direction: 'desc' }} />}</section>
  </main>;
}
