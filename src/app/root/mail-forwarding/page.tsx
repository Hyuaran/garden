"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "../_components/PageHeader";
import { useRootState } from "../_state/RootStateContext";
import { supabase } from "../_lib/supabase";
import DataTable, { type DataColumn } from "@/app/system/_components/DataTable/DataTable";
import Modal from "@/app/system/_components/Modal/Modal";
import UpdatedStamp, { UpdatedStampRow } from "@/app/system/_components/UpdatedStamp/UpdatedStamp";
import { expiry, latestFiling, remaining, sortForwardings, todayJst, tone, validDate, type Filing, type Forwarding } from "@/lib/mail-forwarding/domain";
import { CLARITY_MASK } from "@/app/_lib/clarity-mask";
import styles from "./page.module.css";
import AddressInputs from "./AddressInputs";
import { composeAddress, normalizeAddress, validPostal } from "@/lib/mail-forwarding/address";

export default function MailForwardingPage() {
  const { gardenRole } = useRootState();
  const writable = gardenRole === "super_admin";
  const [rows, setRows] = useState<Forwarding[]>([]), [stamp, setStamp] = useState<string>(), [busy, setBusy] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const [edit, setEdit] = useState<{ mode: "add" | "edit" | "filing"; row: Forwarding } | null>(null);
  const [unfiled, setUnfiled] = useState(false);
  const locked = useRef(false);
  const load = useCallback(async () => {
    if (locked.current) return;
    setBusy(true);
    try {
      const result = await supabase.from("root_mail_forwardings").select("*,filings:root_mail_forwarding_filings(*)");
      if (result.error) throw result.error;
      if (!locked.current) { setRows(result.data as Forwarding[]); setStamp(new Date().toISOString()); setError(""); }
    } catch { setError("郵便の転送を読み込めませんでした。時間をおいてもう一度お試しください。"); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  function open(mode: "add" | "edit" | "filing", row?: Forwarding) {
    setUnfiled(false);
    setEdit({ mode, row: row ?? { id: crypto.randomUUID(), holder: "", from_address: "", to_address: "", notes: "", stopped: false, filings: [] } });
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!edit || !writable || locked.current) return;
    const form = new FormData(event.currentTarget), value = (key: string) => String(form.get(key) ?? "").trim();
    const addressFields = (name: string) => ({ postal: value(name + "_postal"), address: value(name + "_address"), building: value(name + "_building") });
    if (edit.mode !== "filing" && !["from_address", "to_address"].every(name => validPostal(addressFields(name).postal))) { setError("郵便番号は 7 桁の数字です"); return; }
    if (edit.mode !== "filing" && !["from_address", "to_address"].every(name => normalizeAddress(addressFields(name).address))) { setError("必須の欄を確認してください。"); return; }
    const row = edit.mode === "filing" ? edit.row : { ...edit.row, holder: value("holder"), from_address: composeAddress(addressFields("from_address")), to_address: composeAddress(addressFields("to_address")), notes: value("notes"), stopped: form.get("stopped") === "on" };
    const skipFiling = edit.mode === "add" && unfiled;
    const filing: Filing = { id: crypto.randomUUID(), forwarding_id: row.id, filed_on: value("filed_on"), method: value("method") as Filing["method"], receipt: value("receipt"), filed_by: value("filed_by"), notes: value("filing_notes"), created_at: new Date().toISOString() };
    if (!row.holder || !row.from_address || !row.to_address || (edit.mode !== "edit" && !skipFiling && (!validDate(filing.filed_on) || !["e転居", "窓口"].includes(filing.method)))) { setError("必須の欄と届出日を確認してください。"); return; }
    const before = rows, mode = edit.mode;
    const next = mode === "edit" || skipFiling ? row : { ...row, filings: [...row.filings, filing] };
    locked.current = true; setSaving(true); setError(""); setEdit(null);
    setRows(mode === "add" ? [...rows, next] : rows.map(r => r.id === row.id ? next : r));
    try {
      const result = mode === "add" ? await supabase.rpc("root_mail_forwarding_create", { p_row: row, p_filing: skipFiling ? null : filing }) : mode === "filing" ? await supabase.from("root_mail_forwarding_filings").insert({ id: filing.id, forwarding_id: row.id, filed_on: filing.filed_on, method: filing.method, receipt: filing.receipt, filed_by: filing.filed_by, notes: filing.notes }) : await supabase.from("root_mail_forwardings").update({ holder: row.holder, from_address: row.from_address, to_address: row.to_address, notes: row.notes, stopped: row.stopped }).eq("id", row.id).select("id").single();
      if (result.error) throw result.error;
      setStamp(new Date().toISOString());
    } catch { setRows(before); setError("保存できませんでした。変更を戻しました。もう一度お試しください。"); }
    finally { locked.current = false; setSaving(false); }
  }
  const today = todayJst();
  const columns: DataColumn<Forwarding>[] = [
    { id: "holder", label: "名義", type: "text", value: r => r.holder },
    { id: "from", label: "転送元", type: "text", value: r => r.from_address, wrap: true },
    { id: "to", label: "転送先", type: "text", value: r => r.to_address, wrap: true },
    { id: "filed", label: "届出日", type: "date", value: r => latestFiling(r)?.filed_on ?? "届出待ち" },
    { id: "expiry", label: "期限", type: "date", value: r => latestFiling(r) ? expiry(latestFiling(r).filed_on) : "―" },
    { id: "remaining", label: "残り", type: "text", align: "mark", value: r => r.stopped ? "止めた" : latestFiling(r) ? String(remaining(latestFiling(r).filed_on, today)) : "届出待ち", render: r => {
      if (r.stopped) return <span className={styles.stopped}>止めた</span>;
      if (!latestFiling(r)) return <span className={styles.status} data-tone="ng"><svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m4.5 4.5 11 11m0-11-11 11"/></svg>届出待ち</span>;
      const days = remaining(latestFiling(r).filed_on, today), status = tone(days);
      return <span className={styles.status} data-tone={status}><svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">{status === "ok" ? <><circle cx="10" cy="10" r="7.5"/><circle cx="10" cy="10" r="3.5"/></> : status === "wait" ? <path d="M10 3 17.5 16.5H2.5Z"/> : <path d="m4.5 4.5 11 11m0-11-11 11"/>}</svg>{days < 0 ? "切れ" : `${days} 日`}</span>;
    } },
    { id: "actions", label: "届出", type: "text", align: "mark", value: () => "", render: r => writable && !r.stopped && <button disabled={saving || busy} onClick={event => { event.stopPropagation(); open("filing", r); }}>{latestFiling(r) ? "届け直した" : "届け出た"}</button> },
  ];
  return <div className={styles.page} {...CLARITY_MASK}>
    <PageHeader title="郵便の転送" />
    <UpdatedStampRow><UpdatedStamp label="郵便の転送" date={stamp} onRefresh={() => void load()} busy={busy} disabled={saving} refreshLabel="郵便の転送を取り直す" /></UpdatedStampRow>
    {error && !edit && <p role="alert" className={styles.error}>{error}</p>}
    {busy && !stamp && <p role="status">読み込んでいます。</p>}
    <DataTable rows={sortForwardings(rows)} columns={columns} rowKey={r => r.id} searchText={r => `${r.holder} ${r.from_address} ${r.to_address}`} defaultSort={{ id: "default", direction: "asc" }} searchPlaceholder="名義・住所" summary={r => <span>{r.length} 件</span>} toolbar={writable && <button disabled={saving || busy} onClick={() => open("add")}><svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true"><path d="M10 3v14M3 10h14"/></svg>転送を追加</button>} onRowClick={r => { if (!saving && !busy) open("edit", r); }} />
    {edit && <Modal title={edit.mode === "add" ? "転送を追加" : edit.mode === "filing" ? (latestFiling(edit.row) ? "届け直した" : "届け出た") : "郵便の転送"} onClose={() => setEdit(null)} className={styles.dialog}>
      <form onSubmit={save} className={styles.form}>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {edit.row.guide_path && <p className={styles.guide}><a href={`/api/root/mail-forwarding/guide?id=${encodeURIComponent(edit.row.id)}`} target="_blank" rel="noopener noreferrer"><svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="2.5" width="14" height="15" rx="1.5"/><path d="M6.5 7h7M6.5 10h7M6.5 13h4"/></svg>転居届の書き方（画像）を開く</a></p>}
        <fieldset disabled={!writable}>
          {edit.mode !== "filing" && <><label>名義（必須）<input name="holder" required defaultValue={edit.row.holder}/></label>{([["from_address", "転送元の住所"], ["to_address", "転送先の住所"]] as const).map(([name, label]) => <AddressInputs key={name} name={name} label={label} initial={edit.row[name]} />)}<label>メモ<textarea name="notes" defaultValue={edit.row.notes}/></label>{edit.mode === "edit" && <label><input type="checkbox" name="stopped" defaultChecked={edit.row.stopped}/>止める</label>}</>}
          {edit.mode === "add" && <label><input type="checkbox" checked={unfiled} onChange={e => setUnfiled(e.target.checked)}/>まだ届けていない（届出待ち）</label>}
          {edit.mode !== "edit" && !unfiled && <><label>{edit.mode === "add" ? "最初の届出日" : "新しい届出日"}（必須）<input name="filed_on" type="date" required defaultValue={today}/></label><div>届出の方法<div className={styles.radios}>{["e転居", "窓口"].map(m => <label key={m}><input type="radio" name="method" value={m} defaultChecked={m === "e転居"}/>{m}</label>)}</div></div><label>受付番号<input name="receipt"/></label><label>届けた人<input name="filed_by"/></label><label>届出のメモ<textarea name="filing_notes"/></label></>}
        </fieldset>
        {edit.mode === "edit" && <section><h3>届出の記録</h3>{[...edit.row.filings].sort((a,b) => b.filed_on.localeCompare(a.filed_on) || (b.created_at ?? "").localeCompare(a.created_at ?? "")).map(f => <article key={f.id}><b>{f.filed_on}・{f.method}</b><p>受付番号：{f.receipt || "記録なし"}／届けた人：{f.filed_by || "記録なし"}</p>{f.notes && <p>{f.notes}</p>}</article>)}</section>}
        <div data-modal-actions><button type="button" onClick={() => setEdit(null)}>閉じる</button>{writable && <button type="submit" className={styles.primary}>保存</button>}</div>
      </form>
    </Modal>}
  </div>;
}
