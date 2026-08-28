"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { ContractCompany, ContractDraft, ContractRow } from "./_lib/contract-types";
import styles from "./contracts.module.css";

type DriveEntry = { id: string; name: string; mimeType: string; webViewLink: string | null; modifiedTime: string | null };
const FOLDER = "application/vnd.google-apps.folder";

export default function ContractsPage() {
  const [tab, setTab] = useState<"browse" | "register">("browse");
  const [companies, setCompanies] = useState<ContractCompany[]>([]);
  const [rows, setRows] = useState<ContractRow[]>([]);
  const [entries, setEntries] = useState<DriveEntry[]>([]);
  const [path, setPath] = useState<{ id: string | null; name: string }[]>([{ id: null, name: "契約書" }]);
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<ContractDraft | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [template, setTemplate] = useState<ContractRow | null>(null);
  const [issuerId, setIssuerId] = useState("");
  const [product, setProduct] = useState("");
  async function loadLedger() {
    const response = await fetch("/api/system/contracts");
    if (!response.ok) return setMessage("契約書を読み込めませんでした。時間をおいて再度お試しください。");
    const json = await response.json(); setCompanies(json.companies ?? []); setRows(json.rows ?? []);
  }
  async function browse(folderId: string | null) {
    setBusy(true);
    const query = folderId ? `?browse=1&folderId=${encodeURIComponent(folderId)}` : "?browse=1";
    const response = await fetch(`/api/system/contracts${query}`);
    const json = await response.json(); setBusy(false);
    if (!response.ok) return setMessage(json.error ?? "Driveを表示できませんでした。管理者へ連絡してください。");
    setEntries(json.entries ?? []);
  }
  useEffect(() => {
    // Initial API hydration is intentionally performed once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void Promise.all([loadLedger(), browse(null)]);
  }, []);
  async function choose(next: File | null) {
    setFile(next); setDraft(null); setMessage(""); if (!next) return;
    const form = new FormData(); form.set("action", "analyze"); form.set("file", next); setBusy(true);
    const response = await fetch("/api/system/contracts", { method: "POST", body: form });
    const json = await response.json(); setBusy(false);
    if (!response.ok) return setMessage(json.error); setDraft(json.draft);
  }
  async function register(event: FormEvent) {
    event.preventDefault(); if (!file || !draft) return;
    const form = new FormData(); form.set("action", "register"); form.set("file", file);
    Object.entries({ counterparty: draft.counterparty, companyId: draft.companyId, contractType: draft.contractType,
      concludedOn: draft.concludedOn, note: draft.note }).forEach(([key, value]) => form.set(key, String(value)));
    setBusy(true); const response = await fetch("/api/system/contracts", { method: "POST", body: form });
    const json = await response.json(); setBusy(false);
    if (!response.ok) return setMessage(json.error ?? "登録できませんでした。入力内容を確認してください。");
    setMessage(json.driveStatus === "skipped" ? "台帳へ登録しました。Driveの設定は管理者へ確認してください。" : "契約書を登録し、Driveへ保存しました。");
    setFile(null); setDraft(null); await loadLedger();
  }
  const companyLabel = (id: string) => id === "ALL" ? "全社" : companies.find((company) => company.company_id === id)?.company_name ?? id;
  function openTemplate(row: ContractRow) {
    setTemplate(row); setIssuerId(row.company_id === "ALL" ? companies[0]?.company_id ?? "" : row.company_id);
    setProduct(row.product || row.contract_type);
  }
  async function generate() {
    if (!template) return;
    const form = new FormData(); form.set("action", "template"); form.set("id", template.id); form.set("issuerId", issuerId); form.set("product", product);
    setBusy(true); const response = await fetch("/api/system/contracts", { method: "POST", body: form });
    const json = await response.json(); setBusy(false);
    if (!response.ok) return setMessage(json.error ?? "ひな形を作成できませんでした。管理者へ連絡してください。");
    setMessage(json.files?.status === "skipped" ? "ひな形を作成しました。Driveの設定は管理者へ確認してください。" : "WordとPDFのひな形を作成し、Driveへ保存しました。");
    setTemplate(null); await loadLedger();
  }
  return <div className={styles.pageShell}><main className={styles.main}>
    <header className={styles.header}><div><p className={styles.eyebrow}>SYSTEM / CONTRACTS</p><h1>契約書管理</h1><p>契約書の確認、登録、パートナー配布用ひな形の作成を行います。</p></div></header>
    {message && <p role="status" className={styles.message}>{message}</p>}
    <div className={styles.tabs} role="tablist">
      <button role="tab" aria-selected={tab === "browse"} onClick={() => setTab("browse")}>契約書を見る</button>
      <button role="tab" aria-selected={tab === "register"} onClick={() => setTab("register")}>契約書を登録する</button>
    </div>
    {tab === "browse" ? <section className={styles.card}>
      <h2>Driveの契約書</h2><nav className={styles.breadcrumbs} aria-label="現在のフォルダ">
        {path.map((part, index) => <button key={`${part.id}-${index}`} onClick={() => { const next = path.slice(0, index + 1); setPath(next); void browse(part.id); }}>{part.name}</button>)}
      </nav>
      {busy ? <p>読み込み中…</p> : <div className={styles.fileGrid}>{entries.map((entry) => entry.mimeType === FOLDER ?
        <button className={styles.folder} key={entry.id} onClick={() => { setPath([...path, { id: entry.id, name: entry.name }]); void browse(entry.id); }}>📁 <span>{entry.name}</span></button> :
        <a className={styles.file} key={entry.id} href={entry.webViewLink ?? `https://drive.google.com/open?id=${entry.id}`} target="_blank" rel="noreferrer">📄 <span>{entry.name}</span></a>)}</div>}
    </section> : <>
      <section className={styles.card}><h2>上位店契約を登録する</h2><label className={styles.field}>PDFを選ぶ<input type="file" accept="application/pdf,.pdf" onChange={(event) => void choose(event.target.files?.[0] ?? null)} /></label>
      {busy && !draft && <p>読み取り中…</p>}{draft && <form onSubmit={register}><h3>読み取り結果を確認してください</h3>
        {(draft.scanned || !draft.counterparty || !draft.contractType || !draft.concludedOn) && <p role="alert" className={styles.warning}>読み取れませんでした。空欄の項目を入力してください。</p>}
        {draft.ownPartyWarning && <p role="alert" className={styles.warning}>自社が甲になっています。甲乙を確認してください。</p>}
        <p>甲: {draft.partyA || "読み取れませんでした。入力してください"}<br/>乙: {draft.partyB || "読み取れませんでした。入力してください"}</p>
        <div className={styles.formGrid}><label>相手先<input required value={draft.counterparty} onChange={(e) => setDraft({ ...draft, counterparty: e.target.value })}/></label>
        <label>自社法人<select required value={draft.companyId} onChange={(e) => setDraft({ ...draft, companyId: e.target.value })}><option value="">選択してください</option>{companies.map((c) => <option key={c.company_id} value={c.company_id}>{c.company_name}</option>)}<option value="ALL">複数法人（ALL）</option></select></label>
        <label>契約種別<input required value={draft.contractType} onChange={(e) => setDraft({ ...draft, contractType: e.target.value })}/></label>
        <label>締結日<input required type="date" value={draft.concludedOn} onChange={(e) => setDraft({ ...draft, concludedOn: e.target.value })}/></label>
        <label className={styles.full}>メモ<textarea value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })}/></label></div>
        <button className={styles.primary} disabled={busy}>これで登録する</button></form>}</section>
      <section className={styles.card}><h2>登録済み契約</h2><div className={styles.rows}>{rows.map((row) => <article key={row.id}><div><strong>{row.counterparty}</strong><span>{companyLabel(row.company_id)} / {row.contract_type} / {row.concluded_on}</span></div><div className={styles.actions}>{row.drive_url && <a href={row.drive_url} target="_blank" rel="noreferrer">元PDF</a>}{row.template_url && <a href={row.template_url} target="_blank" rel="noreferrer">PDFひな形</a>}{row.template_docx_url && <a href={row.template_docx_url} target="_blank" rel="noreferrer">Wordひな形</a>}<button onClick={() => openTemplate(row)} disabled={!row.drive_file_id}>ひな形を作る</button></div></article>)}</div></section>
    </>}
    {template && <div className={styles.overlay}><section role="dialog" aria-modal="true" className={styles.dialog}><h2>パートナー配布用ひな形</h2><p>元PDFの条文を自社書式で組み直し、WordとPDFを作成します。</p>
      <label>発行元<select value={issuerId} onChange={(e) => setIssuerId(e.target.value)}>{companies.map((c) => <option key={c.company_id} value={c.company_id}>{c.company_name}</option>)}</select></label>
      <label>商材<input value={product} onChange={(e) => setProduct(e.target.value)}/></label><p>上位店情報、金額、料率、具体的な期間はひな形に入りません。</p>
      <button className={styles.primary} onClick={() => void generate()} disabled={busy || !issuerId || !product}>WordとPDFを作成する</button><button onClick={() => setTemplate(null)}>閉じる</button>
    </section></div>}
  </main></div>;
}
