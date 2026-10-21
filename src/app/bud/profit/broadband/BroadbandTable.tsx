"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import SystemTabs, { TabActionButton } from "@/app/system/_components/SystemTabs/SystemTabs";
import UpdatedStamp, { UpdatedStampRow } from "@/app/system/_components/UpdatedStamp/UpdatedStamp";
import BoxSelect from "@/app/system/_components/BoxSelect/BoxSelect";
import { buildPivot, cellTone, kintoneLink, money, periodMonths, periodOptions, readSort, recordStatus, saveSort, sortOptions, statusLabels, total, type SortMode, type TableRecord } from "@/lib/bud/broadband/table";
import styles from "./broadband.module.css";

export function Details({rows, kintoneBase, onClose}: {rows:TableRecord[]; kintoneBase:string; onClose:()=>void}) {
  return <section className={styles.details} aria-label="収支の明細"><h2>収支の明細</h2><button onClick={onClose}>閉じる</button>{rows.map(r => <article key={r.kintone_record_id}><h3>{r.business} / {r.partner}</h3><dl>
    <dt>予定日</dt><dd>{r.scheduled_date ?? "記録なし"}</dd><dt>実績期間</dt><dd>{r.actual_period ?? "記録なし"}</dd><dt>商材名</dt><dd>{r.product}</dd><dt>税抜</dt><dd>{money(r.profit_net)}</dd><dt>予定の税込</dt><dd>{money(r.expected_gross)}</dd>
    <dt>口座の実際</dt><dd>{r.recon_bank?.length ? r.recon_bank.map(b => <p key={b.mf_transaction_id}>{b.date} / {money(Math.abs(b.value))} / {b.bank_name} / {b.content}</p>) : r.mf_date ? `${r.mf_date} / ${money(r.mf_amount)} / ${r.mf_bank} / ${r.mf_content}` : "記録なし"}</dd>
    <dt>差</dt><dd>{r.recon_fee ? `手数料 ${money(r.recon_fee)}` : r.recon_bank?.length ? r.recon_bank.map(b => money(r.expected_gross == null ? null : r.expected_gross-Math.abs(b.value))).join(" / ") : r.expected_gross != null && r.mf_amount != null ? money(r.expected_gross-Math.abs(r.mf_amount)) : "記録なし"}</dd>
    <dt>状態</dt><dd>{recordStatus(r) ? statusLabels[recordStatus(r)!] : "未確認"}</dd></dl>{kintoneBase && <a href={kintoneLink(kintoneBase,r.kintone_record_id)} target="_blank" rel="noopener noreferrer">Kintone で開く</a>}</article>)}</section>;
}
export default function BroadbandTable({rows,userId,today,kintoneBase}: {rows:TableRecord[];userId:string;today:string;kintoneBase:string}) {
  const router=useRouter();
  const [periods,setPeriods]=useState(["current"]), [sort,setSort]=useState<SortMode>("cash"), [sorting,setSorting]=useState(false), [selected,setSelected]=useState<TableRecord[]|null>(null), [busy,setBusy]=useState(false), [message,setMessage]=useState("");
  useEffect(() => { try { setSort(readSort(window.localStorage,userId)); } catch { setSort("cash"); } },[userId]);
  const months=periodMonths(periods,today), pivot=buildPivot(rows,months,sort);
  // 行の無い欄は空にする（0 円を並べない）。小計・総合計の行は色を付けない（色は取引先の行だけ）
  const cell=(records:TableRecord[], label:string, toned=true) => records.length ? <button aria-label={`${label} ${money(total(records))}の明細`} className={toned ? styles[cellTone(records)] : undefined} onClick={() => setSelected(records)}>{money(total(records))}</button> : null;
  return <div className={styles.pageShell}><SystemBreadcrumb root={{label:"Bud",href:"/bud/dashboard"}} items={[{label:"損益管理",href:"/bud/profit"},{label:"ブロードバンド事業の収支"}]} /><h1>ブロードバンド事業の収支</h1>
    <UpdatedStampRow><UpdatedStamp label="Kintone" date={rows.map(r=>r.updated_at).sort().at(-1)} busy={busy} refreshLabel="収支を更新" onRefresh={async()=>{setBusy(true);setMessage("確認中です");try {const response=await fetch("/api/bud/broadband/refresh",{method:"POST"});const result=await response.json();if(!response.ok) throw new Error(result.error);setMessage(result.message ?? "");router.refresh();}catch {setMessage("収支を更新できませんでした。時間をおいてもう一度お試しください。");}finally {setBusy(false);}}} /></UpdatedStampRow>
    <SystemTabs actions={<TabActionButton icon="sort" label="並べ替え" pressed={sorting} onClick={()=>setSorting(!sorting)} />}><button role="tab" aria-selected="true" id="broadband-tab" aria-controls="broadband-panel">収支の表</button></SystemTabs>
    {sorting && <BoxSelect label="並び順" multiple={false} value={[sort]} options={sortOptions} onChange={values=>{const next=values[0] as SortMode;setSort(next);try {saveSort(window.localStorage,userId,next);}catch {}setSorting(false);}} />}
    <section role="tabpanel" id="broadband-panel" aria-labelledby="broadband-tab"><BoxSelect label="期間" value={periods} options={periodOptions(rows,today)} onChange={value=>{setPeriods(value);setSelected(null);}} />
    <p className={styles.legend}>赤＝口座と合わない・まだ届いていない／灰＝予定日前</p>{message && <p role="status">{message}</p>}
    <div className={styles.scroll}><table><thead><tr><th>事業内容</th><th>取引先</th>{months.map(m=><th key={m}>{Number(m.slice(0,4))}年{Number(m.slice(5,7))}月</th>)}<th>合計</th></tr></thead><tbody>{pivot.map(row=><tr key={row.key} className={row.subtotal ? styles.subtotal : undefined}><th scope="row">{row.subtotal ? row.business : ""}</th><td>{row.partner}</td>{months.map(month=><td key={month}>{cell(row.records.filter(r=>r.scheduled_date?.startsWith(month)),`${row.business} ${row.partner} ${month}`,!row.subtotal)}</td>)}<td>{cell(row.records,`${row.business} ${row.partner} 合計`,!row.subtotal)}</td></tr>)}</tbody></table></div>
    {selected && <Details rows={selected} kintoneBase={kintoneBase} onClose={()=>setSelected(null)} />}</section></div>;
}
