"use client";
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import type { ContractCompany, ContractDraft, ContractRow } from "./_lib/contract-types";
import { extractContractPdfPages } from "./_lib/contract-pdf.client";
import styles from "./contracts.module.css";

type DriveEntry = { id: string; name: string; mimeType: string; webViewLink: string | null; modifiedTime: string | null };
type ApiResponse = {
  companies?: ContractCompany[]; rows?: ContractRow[]; entries?: DriveEntry[];
  error?: string; draft?: ContractDraft; driveStatus?: string; files?: { status?: string };
};
const FOLDER = "application/vnd.google-apps.folder";
const MAX_FILE_SIZE = 20 * 1024 * 1024;

function DriveFolderIcon() {
  return <svg className={styles.driveIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 7.5h6l2-2h3l2 2h4v10.5a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3.5 18z"/><path d="M3.5 10h17"/></svg>;
}

function DriveFileIcon() {
  return <svg className={styles.driveIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z"/><path d="M14 3.5v4h4"/><path d="M8.5 12h6M8.5 16h6"/></svg>;
}

async function responseBody(response: Response) {
  try {
    const text = await response.text();
    return text ? (JSON.parse(text) as ApiResponse) : null;
  } catch {
    return null;
  }
}

export default function ContractsPage() {
  const [tab, setTab] = useState<"browse" | "register">("browse");
  const [companies, setCompanies] = useState<ContractCompany[]>([]);
  const [rows, setRows] = useState<ContractRow[]>([]);
  const [entries, setEntries] = useState<DriveEntry[]>([]);
  const [path, setPath] = useState<{ id: string | null; name: string }[]>([{ id: null, name: "契約書" }]);
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<ContractDraft | null>(null);
  const [sourcePages, setSourcePages] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [registrationMessage, setRegistrationMessage] = useState("");
  const [fileError, setFileError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState<"browse" | "analyze" | "register" | "template" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [template, setTemplate] = useState<ContractRow | null>(null);
  const [issuerId, setIssuerId] = useState("");
  const [product, setProduct] = useState("");
  async function loadLedger() {
    try {
      const response = await fetch("/api/system/contracts"), json = await responseBody(response);
      if (!response.ok || !json) return setMessage(response.status === 403 ? "この画面を見る権限がありません。管理者へ連絡してください。" : "契約書を読み込めませんでした。時間をおいて再度お試しください。");
      setCompanies(json.companies ?? []); setRows(json.rows ?? []);
    } catch { setMessage("契約書を読み込めませんでした。時間をおいて再度お試しください。"); }
  }
  async function browse(folderId: string | null) {
    setLoading("browse");
    try {
      const query = folderId ? `?browse=1&folderId=${encodeURIComponent(folderId)}` : "?browse=1";
      const response = await fetch(`/api/system/contracts${query}`);
      const json = await responseBody(response);
      if (!response.ok || !json) return setMessage(response.status === 403 ? "この画面を見る権限がありません。管理者へ連絡してください。" : json?.error ?? "Driveを表示できませんでした。管理者へ連絡してください。");
      setEntries(json.entries ?? []);
    } catch { setMessage("Driveを表示できませんでした。管理者へ連絡してください。"); } finally { setLoading(null); }
  }
  useEffect(() => {
    // Initial API hydration is intentionally performed once on mount.
    void Promise.all([loadLedger(), browse(null)]);
  }, []);
  async function choose(next: File | null) {
    setDraft(null); setSourcePages([]); setFileError(""); setRegistrationMessage("");
    if (!next) { setFile(null); return; }
    if (next.type !== "application/pdf" && !next.name.toLowerCase().endsWith(".pdf")) { setFile(null); return setFileError("PDFファイルを選んでください。"); }
    if (next.size > MAX_FILE_SIZE) { setFile(null); return setFileError("PDFは20MBまでです。ファイルサイズを確認してください。"); }
    setFile(next); setLoading("analyze");
    try {
      const pages = await extractContractPdfPages(next);
      setSourcePages(pages);
      const form = new FormData(); form.set("action", "analyze"); form.set("extractedText", JSON.stringify(pages));
      const response = await fetch("/api/system/contracts", { method: "POST", body: form });
      const json = await responseBody(response);
      if (!response.ok || !json) return setFileError(json?.error ?? "この契約書を読み取れませんでした。ファイルが壊れていないか確認してください。");
      if (!json.draft) return setFileError("この契約書を読み取れませんでした。ファイルが壊れていないか確認してください。");
      setDraft(json.draft);
    } catch { setFileError("この契約書を読み取れませんでした。ファイルが壊れていないか確認してください。"); } finally { setLoading(null); }
  }
  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault(); setDragActive(false); void choose(event.dataTransfer.files[0] ?? null);
  }
  function resetFile() { setFile(null); setDraft(null); setSourcePages([]); setFileError(""); setRegistrationMessage(""); if (fileInputRef.current) fileInputRef.current.value = ""; }
  async function register(event: FormEvent) {
    event.preventDefault(); if (!file || !draft) return;
    const form = new FormData(); form.set("action", "register"); form.set("file", file); form.set("extractedText", JSON.stringify(sourcePages));
    Object.entries({ counterparty: draft.counterparty, companyId: draft.companyId, contractType: draft.contractType,
      concludedOn: draft.concludedOn, note: draft.note }).forEach(([key, value]) => form.set(key, String(value)));
    setLoading("register"); setRegistrationMessage("");
    try {
      const response = await fetch("/api/system/contracts", { method: "POST", body: form });
      const json = await responseBody(response);
      if (!response.ok || !json) return setRegistrationMessage(json?.error ?? "契約書を登録できませんでした。通信状況を確認して、もう一度お試しください。");
      setRegistrationMessage(json.driveStatus === "skipped" ? "台帳へ登録しました。Driveの設定は管理者へ確認してください。" : "契約書を登録し、Driveへ保存しました。");
      await loadLedger();
    } catch { setRegistrationMessage("契約書を登録できませんでした。通信状況を確認して、もう一度お試しください。"); } finally { setLoading(null); }
  }
  const companyLabel = (id: string) => id === "ALL" ? "全社" : companies.find((company) => company.company_id === id)?.company_name ?? id;
  function openTemplate(row: ContractRow) {
    setTemplate(row); setIssuerId(row.company_id === "ALL" ? companies[0]?.company_id ?? "" : row.company_id);
    setProduct(row.product || row.contract_type);
  }
  async function generate() {
    if (!template) return;
    const form = new FormData(); form.set("action", "template"); form.set("id", template.id); form.set("issuerId", issuerId); form.set("product", product);
    setLoading("template");
    try {
      const response = await fetch("/api/system/contracts", { method: "POST", body: form });
      const json = await responseBody(response);
      if (!response.ok || !json) return setMessage(json?.error ?? "ひな形を作成できませんでした。管理者へ連絡してください。");
      setMessage(json.files?.status === "skipped" ? "ひな形を作成しました。Driveの設定は管理者へ確認してください。" : "WordとPDFのひな形を作成し、Driveへ保存しました。");
      setTemplate(null); await loadLedger();
    } catch { setMessage("ひな形を作成できませんでした。管理者へ連絡してください。"); } finally { setLoading(null); }
  }
  return <div className={styles.pageShell}><div className={styles.main}>
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
      {loading === "browse" ? <p className={styles.loading}><span/>読み込み中…</p> : <div className={styles.fileGrid}>{entries.map((entry) => entry.mimeType === FOLDER ?
        <button className={styles.folder} key={entry.id} onClick={() => { setPath([...path, { id: entry.id, name: entry.name }]); void browse(entry.id); }}><DriveFolderIcon/><span>{entry.name}</span></button> :
        <a className={styles.file} key={entry.id} href={entry.webViewLink ?? `https://drive.google.com/open?id=${entry.id}`} target="_blank" rel="noreferrer"><DriveFileIcon/><span>{entry.name}</span></a>)}</div>}
    </section> : <>
      <section className={`${styles.card} ${styles.registrationCard}`}><h2>上位店契約を登録する</h2>
        <div className={styles.stepHeading}><span><small>STEP</small><strong>1</strong></span><h3>契約書をアップロード</h3></div>
        <input ref={fileInputRef} data-testid="contract-file-input" className={styles.hiddenFileInput} type="file" accept="application/pdf,.pdf" onChange={(event) => void choose(event.target.files?.[0] ?? null)} />
        <div className={`${styles.dropZone} ${dragActive ? styles.dropZoneActive : ""}`} role="button" tabIndex={0}
          aria-label="契約書PDFをアップロード" onClick={() => fileInputRef.current?.click()}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") fileInputRef.current?.click(); }}
          onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
          onDragLeave={(event) => { event.preventDefault(); setDragActive(false); }} onDrop={drop}>
          <svg className={styles.pdfIcon} viewBox="0 0 88 104" aria-hidden="true"><path d="M12 3h43l21 21v77H12z"/><path d="M55 3v22h21"/><rect x="3" y="49" width="58" height="29" rx="5"/><text x="14" y="70">PDF</text></svg>
          {file ? <div className={styles.selectedFile}><strong>{file.name}</strong><button type="button" onClick={(event) => { event.stopPropagation(); resetFile(); }}>選び直す</button></div> : <>
            <div className={styles.uploadNotes}><span>PDF形式のみ</span><span>20MBまで</span><span>画像として取り込まれた契約書（スキャン）は、読み取れないため手入力になります</span></div>
            <button type="button" className={styles.uploadButton} onClick={(event) => { event.stopPropagation(); fileInputRef.current?.click(); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0L7 9m5-5 5 5M5 15v4h14v-4"/></svg>PDFをアップロード</button>
          </>}
        </div>
        {fileError && !file && <p role="alert" className={styles.fileError}>{fileError}</p>}
        {file && <div className={styles.stepBlock}><div className={styles.stepHeading}><span><small>STEP</small><strong>2</strong></span><h3>読み取り結果を確認</h3></div>
          {loading === "analyze" ? <p className={styles.loading} role="status"><span/>契約書を読み取っています…</p> : draft ? <form onSubmit={register}>
            {draft.scanned && <p role="alert" className={styles.warning}>読み取れませんでした。空欄の項目を入力してください。</p>}
            {draft.ownPartyWarning && <p role="alert" className={styles.warning}>自社が甲になっています。甲乙を確認してください。</p>}
            <p>甲: {draft.partyA || "読み取れませんでした。入力してください"}<br/>乙: {draft.partyB || "読み取れませんでした。入力してください"}</p>
            <div className={styles.formGrid}>
              <label>相手先<input required value={draft.counterparty} onChange={(e) => setDraft({ ...draft, counterparty: e.target.value })}/>{!draft.counterparty && <small className={styles.missing}>読み取れませんでした。入力してください</small>}</label>
              <label>自社法人<select required value={draft.companyId} onChange={(e) => setDraft({ ...draft, companyId: e.target.value })}><option value="">選択してください</option>{companies.map((c) => <option key={c.company_id} value={c.company_id}>{c.company_name}</option>)}<option value="ALL">複数法人（ALL）</option></select>{!draft.companyId && <small className={styles.missing}>読み取れませんでした。入力してください</small>}</label>
              <label>契約種別<input required value={draft.contractType} onChange={(e) => setDraft({ ...draft, contractType: e.target.value })}/>{!draft.contractType && <small className={styles.missing}>読み取れませんでした。入力してください</small>}</label>
              <label>締結日<input required type="date" value={draft.concludedOn} onChange={(e) => setDraft({ ...draft, concludedOn: e.target.value })}/>{!draft.concludedOn && <small className={styles.missing}>読み取れませんでした。入力してください</small>}</label>
              <label className={styles.full}>メモ<textarea value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })}/></label>
            </div>
            <div className={styles.stepBlock}><div className={styles.stepHeading}><span><small>STEP</small><strong>3</strong></span><h3>登録する</h3></div>
              <button className={styles.primary} disabled={loading === "register" || Boolean(registrationMessage)}>{loading === "register" ? "登録しています…" : "これで登録する"}</button>
              {registrationMessage && <p role="status" className={styles.registrationResult}>{registrationMessage}</p>}
            </div>
          </form> : fileError ? <p role="alert" className={styles.warning}>{fileError}</p> : null}
        </div>}
      </section>
      <section className={styles.card}><h2>登録済み契約</h2><div className={styles.rows}>{rows.map((row) => <article key={row.id}><div><strong>{row.counterparty}</strong><span>{companyLabel(row.company_id)} / {row.contract_type} / {row.concluded_on}</span></div><div className={styles.actions}>{row.drive_url && <a href={row.drive_url} target="_blank" rel="noreferrer">元PDF</a>}{row.template_url && <a href={row.template_url} target="_blank" rel="noreferrer">PDFひな形</a>}{row.template_docx_url && <a href={row.template_docx_url} target="_blank" rel="noreferrer">Wordひな形</a>}<button onClick={() => openTemplate(row)} disabled={!row.drive_file_id}>ひな形を作る</button></div></article>)}</div></section>
    </>}
    {template && <div className={styles.overlay}><section role="dialog" aria-modal="true" className={styles.dialog}><h2>パートナー配布用ひな形</h2><p>元PDFの条文を自社書式で組み直し、WordとPDFを作成します。</p>
      <label>発行元<select value={issuerId} onChange={(e) => setIssuerId(e.target.value)}>{companies.map((c) => <option key={c.company_id} value={c.company_id}>{c.company_name}</option>)}</select></label>
      <label>商材<input value={product} onChange={(e) => setProduct(e.target.value)}/></label><p>上位店情報、金額、料率、具体的な期間はひな形に入りません。</p>
      <button className={styles.primary} onClick={() => void generate()} disabled={loading === "template" || !issuerId || !product}>{loading === "template" ? "作成しています…" : "WordとPDFを作成する"}</button><button onClick={() => setTemplate(null)}>閉じる</button>
    </section></div>}
  </div></div>;
}
