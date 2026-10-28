"use client";
import { agentName } from "@/lib/bud/broadband/agent-names";
import { useStickyTable } from "@/app/system/_components/StickyTable/useStickyTable";
import ReorderGrip from "@/app/system/_components/ReorderGrip/ReorderGrip";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import SystemTabs, { TabActionButton } from "@/app/system/_components/SystemTabs/SystemTabs";
import UpdatedStamp, { UpdatedStampRow } from "@/app/system/_components/UpdatedStamp/UpdatedStamp";
import BoxSelect from "@/app/system/_components/BoxSelect/BoxSelect";
import { buildPivot, defaultPeriod, cellTone, kintoneLink, money, periodMonths, periodOptions, applyOrder, movePivot, orderFromPivot, readOrder, recordStatus, saveOrder, sortOptions, statusLabels, total, type BroadbandOrder, type PivotRow, type SortMode, type TableRecord } from "@/lib/bud/broadband/table";
import type { AgentDetail } from "@/lib/bud/broadband/agent-details";
import Modal from "@/app/system/_components/Modal/Modal";
import { driveLink } from "@/lib/bud/broadband/table";
import { reconciliationDeadline } from "@/lib/bud/broadband/reconcile";
import type { Bank } from "@/lib/bud/broadband/reconcile";
import { isK, isNtt, nttReference } from "@/lib/bud/broadband/references";
import styles from "./broadband.module.css";
import ViewerPicker, { type ViewerEmployee } from "@/app/bud/_components/ViewerPicker/ViewerPicker";
import viewerStyles from "@/app/bud/_components/ViewerPicker/ViewerPicker.module.css";

const businessTabs = [["broadband","ブロードバンド事業"],["telema","テレマ事業"],["stock","ストック事業"],["kanden","関西電力事業"],["breaker","ブレーカー事業"],["nhk","NHK事業"],["other","その他"],["ses","SES事業"]] as const;
type BusinessTab = typeof businessTabs[number][0];
const businessCodes: Partial<Record<BusinessTab,string[]>> = {telema:["101","103","105"],stock:["200","201","210","211"],kanden:["102"],breaker:["300","301"],other:["104"]};
function Difference({row:r,daysAfter}:{row:TableRecord;daysAfter:number}) {
 const status=recordStatus(r);
 if(!["amount_mismatch","not_arrived","ambiguous"].includes(status??"")) return null;
 return <div className={styles.difference}><strong>{statusLabels[status!]}</strong>{status==="not_arrived" ? <p>予定日を過ぎても入金（支払い）が見つかりません。予定 {money(r.expected_gross)}（税込）・{r.scheduled_date ? reconciliationDeadline(r.scheduled_date,daysAfter) : "記録なし"}まで探しました</p> : <><p>予定（税込） {money(r.expected_gross)}</p>{r.recon_bank?.map(b=><p key={b.mf_transaction_id}>{status==="ambiguous" ? "同じ金額の候補" : "口座に届いた"} {money(Math.abs(b.value))}（{b.bank_name} {b.date} {b.content}）{status==="amount_mismatch" && r.expected_gross!=null && <>・差 {money(Math.abs(Math.abs(b.value)-Math.abs(r.expected_gross)))} {Math.abs(b.value)>=Math.abs(r.expected_gross) ? "多い" : "少ない"}</>}</p>)}</>}</div>;
}
// 小窓の一番上に状態と差を並べる。印は線の絵（◎ 確認済み＝緑／△ 予定日前・未確認＝黄／✖ 合わない＝赤・2026-10-28）
const diffText=(r:TableRecord)=>{
  const sign=(n:number)=>n===0 ? "±0 円" : money(n);
  if(r.recon_fee) return `手数料 ${money(r.recon_fee)}`;
  if(r.recon_bank?.length) return r.recon_bank.map(b=>r.expected_gross==null ? "記録なし" : sign(r.expected_gross-Math.abs(b.value))).join(" / ");
  return r.expected_gross!=null && r.mf_amount!=null ? sign(r.expected_gross-Math.abs(r.mf_amount)) : "記録なし";
};
function StatusLine({row:r}:{row:TableRecord}) {
  const status=recordStatus(r), tone=status==="matched" ? "ok" : status==="excluded" ? "none" : status==="pending" || !status ? "wait" : "ng";
  const mark=tone==="ok" ? <><circle cx="10" cy="10" r="7.5"/><circle cx="10" cy="10" r="3.5"/></> : tone==="wait" ? <path d="M10 3 L17.5 16.5 H2.5 Z"/> : tone==="ng" ? <path d="M4.5 4.5 L15.5 15.5 M15.5 4.5 L4.5 15.5"/> : null;
  return <p className={styles.statusLine} data-tone={tone}><b>{mark && <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">{mark}</svg>}{status ? statusLabels[status] : "未確認"}</b>{tone!=="none" && <span>差 {diffText(r)}</span>}</p>;
}
export function Details({rows: base, kintoneBase, onClose,title="収支の明細",daysAfter=7,showDifferences=true}: {rows:TableRecord[]; kintoneBase:string; onClose:()=>void;title?:string;daysAfter?:number;showDifferences?:boolean}) {
  // 口座の照合の明細（recon_bank）は表の読み込みに含めず、パネルを開いたときに読む（2026-10-26）
  const [bankById,setBankById]=useState<Record<string,TableRecord["recon_bank"]>>({});
  const ids=base.filter(r=>!r.kintone_record_id.startsWith("agent-") && r.recon_bank===undefined).map(r=>r.kintone_record_id).join(",");
  useEffect(()=>{if(!ids) return; let active=true; fetch("/api/bud/broadband/recon-bank?ids="+encodeURIComponent(ids),{cache:"no-store"}).then(r=>r.ok?r.json():{}).then(d=>{if(active) setBankById(d);}).catch(()=>{}); return ()=>{active=false;};},[ids]);
  const rows=base.map(r=>r.recon_bank===undefined && bankById[r.kintone_record_id] ? {...r,recon_bank:bankById[r.kintone_record_id]} : r);
  return <Modal title={title} onClose={onClose} className={styles.details} actions={<button onClick={onClose}>閉じる</button>}>{rows.map(r => <article key={r.kintone_record_id}>{showDifferences && <Difference row={r} daysAfter={daysAfter}/>}<h3>{r.business} / {r.product}</h3><StatusLine row={r}/><dl>
    <dt>予定日</dt><dd>{r.scheduled_date ?? "記録なし"}</dd><dt>実績期間</dt><dd>{r.actual_period ?? "記録なし"}</dd><dt>商材名</dt><dd>{r.product}</dd><dt>税抜</dt><dd>{money(r.profit_net)}</dd><dt>予定の税込</dt><dd>{money(r.expected_gross)}</dd>
    <dt>口座の実際</dt><dd>{r.recon_bank?.length ? r.recon_bank.map(b => <p key={b.mf_transaction_id}>{b.date} / {money(Math.abs(b.value))} / {b.bank_name} / {b.content}</p>) : r.mf_date ? `${r.mf_date} / ${money(r.mf_amount)} / ${r.mf_bank} / ${r.mf_content}` : "記録なし"}</dd>
    </dl>{kintoneBase && !r.kintone_record_id.startsWith("agent-") && <a href={kintoneLink(kintoneBase,r.kintone_record_id)} target="_blank" rel="noopener noreferrer">Kintoneレコード</a>}{driveLink(r.drive_link) && <a href={driveLink(r.drive_link)!} target="_blank" rel="noopener noreferrer">Googleドライブ明細</a>}</article>)}</Modal>;
}
export default function BroadbandTable({rows,userId,today,kintoneBase,agents=[],bank=[],admin=false,daysAfter=7}: {daysAfter?:number;admin?:boolean;rows:TableRecord[];userId:string;today:string;kintoneBase:string;agents?:AgentDetail[];bank?:Bank[]}) {
  const [tab,setTab]=useState<BusinessTab>("broadband");
  useEffect(()=>{try {const value=new URL(window.location.href).searchParams.get('tab')??localStorage.getItem('bud-bb-tab:'+userId);setTab(businessTabs.some(([key])=>key===value)?value as BusinessTab:'broadband');}catch {}},[userId]);
  const changeTab=(key:BusinessTab)=>{setTab(key);try {localStorage.setItem('bud-bb-tab:'+userId,key);}catch {}try {const url=new URL(window.location.href);url.searchParams.set('tab',key);window.history.replaceState(null,'',url);}catch {}};
  const hasTable=tab!=="nhk" && tab!=="ses";
  const filteredRows=tab==="broadband" ? rows : rows.filter(r=>businessCodes[tab]?.includes(r.business.slice(0,3)));
  const [detailTitle,setDetailTitle]=useState('収支の明細'),[showDifferences,setShowDifferences]=useState(true);
  const [settings,setSettings]=useState(false), [viewers,setViewers]=useState<string[]>([]), [employees,setEmployees]=useState<ViewerEmployee[]>([]);
  const [loadingViewers,setLoadingViewers]=useState(false), [savingViewers,setSavingViewers]=useState(false), [viewersLoaded,setViewersLoaded]=useState(false), [viewerError,setViewerError]=useState("");
  const openSettings=async()=>{
    setSettings(true);setSorting(false);setSelected(null);setReference(null);setViewerError("");setLoadingViewers(true);setViewersLoaded(false);
    try {const response=await fetch("/api/bud/broadband/viewers");const data=await response.json();if(!response.ok) throw new Error();setViewers(data.viewers);setEmployees(data.employees);setViewersLoaded(true);}
    catch {setViewerError("閲覧権限を読み込めませんでした。閉じてもう一度お試しください。");}
    finally {setLoadingViewers(false);}
  };
  const saveViewers=async()=>{
    setSavingViewers(true);setViewerError("");
    try {const response=await fetch("/api/bud/broadband/viewers",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({viewers})});if(!response.ok) {const data=await response.json();throw new Error(data.error || "保存できませんでした");}setSettings(false);}
    catch(error) {setViewerError(error instanceof Error ? error.message : "保存できませんでした");}
    finally {setSavingViewers(false);}
  };
  const [expanded,setExpanded]=useState<string[]>([]), [childrenOrder,setChildrenOrder]=useState<Record<string,string[]>>({});
  const [reference,setReference]=useState<{records:TableRecord[];bank:Bank[]}|null>(null);
  useEffect(()=>{try {const v=JSON.parse(localStorage.getItem('bud-bb-details:'+userId)??'{}');setExpanded(Array.isArray(v.expanded)?v.expanded:[]);setChildrenOrder(v.order??{});}catch {setExpanded([]);setChildrenOrder({});}},[userId]);
  const remember=(open:string[],order:Record<string,string[]>)=>{setExpanded(open);setChildrenOrder(order);try {localStorage.setItem('bud-bb-details:'+userId,JSON.stringify({expanded:open,order}));}catch {}};
  const toggle=(key:string)=>remember(expanded.includes(key)?expanded.filter(k=>k!==key):[...expanded,key],childrenOrder);
  const agentRecords=(parent:PivotRow)=>agents.map((a,i)=>({kintone_record_id:'agent-'+i,business:parent.business,partner:agentName(a.payee),scheduled_date:a.payment_date,actual_period:a.target_month+'-01',profit_net:a.net==null?null:-a.net,product:a.review_reason ? '要確認：'+a.review_reason : a.source_file,updated_at:a.imported_at,recon_status:'excluded',confirmation:'',expected_gross:a.gross} as TableRecord));
  const nttLabel=(name:string)=>name==='NTT原価（壱）' || name==='NTT原価(壱)' ? 'NTT原価（東西）センターライズ' : 'NTT原価（東西）ヒュアラン';
  const router=useRouter();
  const [periods,setPeriods]=useState([defaultPeriod(today)]), [order,setOrder]=useState<BroadbandOrder|null>(null), [sorting,setSorting]=useState(false), [selected,setSelected]=useState<TableRecord[]|null>(null), [busy,setBusy]=useState(false), [message,setMessage]=useState("");
  // 縦はページのスクロールだけ（表の中に縦スクロールを作らない・東海林さん 2026-10-21）。
  // 横スクロールのバーは画面の下に張り付けて、表の下まで行かなくても動かせるようにする
  const scrollRef=useRef<HTMLDivElement>(null);
  useStickyTable(scrollRef, `${tab}:${settings}`);
  useEffect(()=>{try {setOrder(readOrder(window.localStorage,userId));}catch {setOrder(null);}},[userId]);
  const months=periodMonths(periods,today,rows), allMonths=[...new Set(rows.flatMap(r=>r.scheduled_date ? [r.scheduled_date.slice(0,7)] : []))];
  const groupNtt=(source:TableRecord[])=>source.map(r=>isNtt(r.partner)?{...r,partner:nttLabel(r.partner)}:r);
  const fullPivot=applyOrder(buildPivot(groupNtt(rows),allMonths,"cash"),order), pivot=applyOrder(buildPivot(groupNtt(filteredRows),months,"cash"),orderFromPivot(fullPivot));
  type DisplayRow=PivotRow & {parent?:string};
  const visible:DisplayRow[]=pivot.flatMap(row=>{
    if(row.subtotal || !(row.partner==='代理店支払い合計' || isNtt(row.partner)) || !expanded.includes(row.key)) return [row];
    const source=row.partner==='代理店支払い合計' ? agentRecords(row).filter(r=>months.includes(r.scheduled_date!.slice(0,7))) : rows.filter(r=>r.business===row.business && isNtt(r.partner) && nttLabel(r.partner)===row.partner && months.includes(r.scheduled_date?.slice(0,7)??''));
    const names=[...new Set(source.map(r=>r.partner))], saved=childrenOrder[row.key]??[];
    names.sort((a,b)=>(saved.includes(a)?saved.indexOf(a):999)-(saved.includes(b)?saved.indexOf(b):999));
    return [row,...names.map(name=>({key:JSON.stringify([row.key,name]),business:row.business,partner:name,subtotal:false,records:source.filter(r=>r.partner===name),parent:row.key}))];
  }).sort((a,b)=>Number(b.key==="grand")-Number(a.key==="grand")); // 総計は表の一番上（下までスクロールしなくても見えるように・2026-10-28）
  const childGrip=(row:DisplayRow)=><ReorderGrip label={row.partner} itemKey={row.key} keys={visible.filter(r=>r.parent===row.parent).map(r=>r.key)} selector="tr[data-row-key]" attribute="data-row-key" onMove={(from,to)=>{const list=visible.filter(r=>r.parent===row.parent);const a=list.findIndex(r=>r.key===from),b=list.findIndex(r=>r.key===to);if(a<0||b<0)return;list.splice(b,0,...list.splice(a,1));remember(expanded,{...childrenOrder,[row.parent!]:list.map(r=>r.partner)});}} />;
  const renderCell=(row:DisplayRow,month?:string)=>{
    const title=(row.partner || row.business)+" ・ "+(month ? Number(month.slice(0,4))+"年"+Number(month.slice(5,7))+"月" : "期間の合計");
    const records=row.records.filter(r=>!month || r.scheduled_date?.startsWith(month));
    if(isNtt(row.partner)) {const refs=(month?[month]:months).flatMap(m=>nttReference(m,row.partner.includes('センターライズ')||row.partner.includes('壱'),bank));return records.length ? <button disabled={sorting} onClick={()=>{setDetailTitle(title);setSelected(null);setReference({records,bank:refs});}}>{money(total(records))}{row.partner.includes('（東西）') && refs.length>0 && <small className={styles.reference}>口座（税込）の参考 {money(refs.reduce((n,b)=>n+Math.abs(b.value),0))}</small>}</button>:null;}
    const detail=row.partner==='代理店支払い合計' ? agentRecords(row).filter(r=>month ? r.scheduled_date?.startsWith(month) : months.includes(r.scheduled_date?.slice(0,7)??'')) : [];
    const diff=total(records)-total(detail);
    return <>{cell(records,row.partner+(month??' 合計'),!row.subtotal && !row.parent,title)}{detail.length>0 && diff!==0 && <small className={styles.reference}>明細との差 {money(diff)}</small>}{row.parent && records.some(r=>r.profit_net==null || r.product.startsWith('要確認')) && <small>要確認</small>}</>;
  };
  const persist=(next:BroadbandOrder)=>{setOrder(next);try {saveOrder(window.localStorage,userId,next);}catch {}};
  const [dragging,setDragging]=useState<string|null>(null),[target,setTarget]=useState<string|null>(null);
  const stop=()=>{setDragging(null);setTarget(null);};
  const compatible=(a:PivotRow,b:PivotRow)=>b.key!=="grand" && a.subtotal===b.subtotal && (a.subtotal || a.business===b.business);
  const handle=(row:PivotRow)=><ReorderGrip label={row.subtotal ? row.business : row.partner} itemKey={row.key} keys={pivot.filter(r=>compatible(row,r)).map(r=>r.key)} selector="tr[data-row-key]" attribute="data-row-key" resolveTarget={key=>{const hit=pivot.find(r=>r.key===key);return row.subtotal && hit ? pivot.find(r=>r.subtotal && r.business===hit.business)?.key : key;}} onMove={(key,target)=>persist(movePivot(fullPivot,key,target))} onState={(key,target)=>{setDragging(key);setTarget(target);}} />;

  // 行の無い欄は空にする（0 円を並べない）。小計・総合計の行は色を付けない（色は取引先の行だけ）
  const cell=(records:TableRecord[], label:string, toned=true,title="収支の明細") => records.length ? <button aria-label={`${label} ${money(total(records))}の明細`} className={toned ? styles[cellTone(records)] : undefined} disabled={sorting} onClick={() => {if(!sorting) {setDetailTitle(title);setShowDifferences(toned && cellTone(records)==="red");setReference(null);setSelected(records);}}}>{money(total(records))}</button> : null;
  return <div className={styles.pageShell}><SystemBreadcrumb root={{label:"Bud",href:"/bud/dashboard"}} items={[{label:"損益管理",href:"/bud/profit"},{label:"事業の収支"}]} /><h1>事業の収支</h1>
    <UpdatedStampRow><UpdatedStamp label="Kintone" date={rows.map(r=>r.updated_at).sort().at(-1)} busy={busy} refreshLabel="収支を更新" onRefresh={async()=>{setBusy(true);setMessage("確認中です");try {const response=await fetch("/api/bud/broadband/refresh",{method:"POST"});const result=await response.json();if(!response.ok) throw new Error(result.error);setMessage(result.message ?? "");router.refresh();}catch {setMessage("収支を更新できませんでした。時間をおいてもう一度お試しください。");}finally {setBusy(false);}}} /></UpdatedStampRow>
    <div className={styles.tabRow}><SystemTabs actions={<>{hasTable && <TabActionButton icon="sort" label="並べ替え" pressed={sorting} onClick={()=>{if(savingViewers || loadingViewers)return;stop();setSorting(!sorting);setSelected(null);setSettings(false);}} />}{admin && <TabActionButton icon="settings" label="閲覧権限" pressed={settings} onClick={()=>{if(savingViewers || loadingViewers)return;if(settings)setSettings(false);else void openSettings();}} />}</>}>{businessTabs.map(([key,label])=><button key={key} role="tab" aria-selected={tab===key} id={`${key}-tab`} aria-controls={`${key}-panel`} onClick={()=>{if(tab===key)return;stop();setSorting(false);setSelected(null);setReference(null);changeTab(key);}}>{label}</button>)}</SystemTabs></div>
    {settings && <section className={viewerStyles.settings} aria-label="事業の収支の閲覧権限"><h2>事業の収支の閲覧権限</h2><p>ここに入れた人は、事業の収支（すべての事業のタブ）を見られます</p>{loadingViewers ? <p role="status">読み込み中…</p> : viewersLoaded && <><h3>閲覧権限</h3><ViewerPicker employees={employees} value={viewers} onChange={setViewers} disabled={savingViewers} /></>}{viewerError && <p role="alert">{viewerError}</p>}<div className={viewerStyles.actions}><button disabled={!viewersLoaded || loadingViewers || savingViewers} onClick={()=>void saveViewers()}>{savingViewers ? "保存中…" : "保存"}</button><button disabled={savingViewers || loadingViewers} onClick={()=>setSettings(false)}>閉じる</button></div></section>}
    {!settings && !hasTable && <section role="tabpanel" id={`${tab}-panel`} aria-labelledby={`${tab}-tab`} className={styles.preparing}><p>{businessTabs.find(([key])=>key===tab)?.[1]}の収支は、現在作成中です。</p></section>}
    {!settings && hasTable && <>
    {sorting && <div className={styles.orderToolbar} aria-label="並び替えモード">{sortOptions.map(o=><button key={o.value} onClick={()=>persist(orderFromPivot(buildPivot(groupNtt(rows),allMonths,o.value as SortMode)))}>{o.value==="cash" ? "入金 → 支払いの順に戻す" : o.label+"にする"}</button>)}<button onClick={()=>{stop();setSorting(false);}}>終える</button></div>}
    <section role="tabpanel" id={`${tab}-panel`} aria-labelledby={`${tab}-tab`}><div className={styles.periodLegend}><BoxSelect label="期間" value={periods} options={periodOptions(rows,today)} onChange={value=>{setPeriods(value);setSelected(null);}} />
    <div className={styles.legend} aria-label="色の凡例"><div>金額はすべて税抜</div><div><span className={styles.swatch+" "+styles.red} />口座と合わない・まだ届いていない</div><div><span className={styles.swatch+" "+styles.gray} />予定日前</div><div><span className={styles.swatch} />口座で確認済み</div><div>K＝Kintone のアプリの合計（口座とは照合しない）</div></div></div>{message && <p role="status">{message}</p>}
    <div ref={scrollRef} className={styles.scroll}><table><thead><tr><th>事業内容</th><th>取引先</th>{months.map(m=><th key={m}>{Number(m.slice(0,4))}年{Number(m.slice(5,7))}月</th>)}<th>合計（税抜）</th></tr></thead><tbody>{visible.map(row=><tr key={row.key} data-row-key={row.key} className={[row.subtotal ? styles.subtotal : "",(dragging===row.key || (pivot.find(r=>r.key===dragging)?.subtotal && pivot.find(r=>r.key===dragging)?.business===row.business)) ? styles.dragging : "",target===row.key ? styles.dropTarget : ""].join(" ")}><th scope="row" className="garden-cell-text">{sorting && row.subtotal && row.key!=="grand" && handle(row)}{row.subtotal ? row.business : ""}</th><td className="garden-cell-text">{sorting && !row.subtotal && row.key!=="grand" && (row.parent ? childGrip(row) : handle(row))}{!row.subtotal && !row.parent && (row.partner==='代理店支払い合計' || isNtt(row.partner)) && <button className={styles.collapse} aria-label={row.partner+(expanded.includes(row.key)?'を閉じる':'を開く')} aria-expanded={expanded.includes(row.key)} onClick={()=>toggle(row.key)}><svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor"><rect x="2" y="2" width="16" height="16" rx="1"/><path d="M6 10h8"/>{!expanded.includes(row.key)&&<path d="M10 6v8"/>}</svg></button>}{row.parent ? '　'+row.partner : row.partner}{isK(row.partner)&&<span tabIndex={0} aria-label="Kintone のアプリの合計（口座とは照合しない）" className={styles.kMark}>K<span className={styles.kHint}>Kintone のアプリの合計（口座とは照合しない）</span></span>}</td>{months.map(month=><td key={month} className="garden-cell-number">{renderCell(row,month)}</td>)}<td className="garden-cell-number">{renderCell(row)}</td></tr>)}</tbody></table></div>
    {reference && <Modal title={detailTitle} className={styles.details} onClose={()=>setReference(null)} actions={<button onClick={()=>setReference(null)}>閉じる</button>}><dl><dt>Kintone の金額（NTT の書面・税抜）</dt><dd>{money(Math.abs(total(reference.records)))}</dd><dt>Kintone の税込</dt><dd>{money(reference.records.reduce((n,r)=>n+Number(r.expected_gross ?? 0),0))}</dd><dt>口座の参考額（税込）</dt><dd>{money(reference.bank.reduce((n,b)=>n+Math.abs(b.value),0))}</dd><dt>差（Kintone の税込 − 口座）</dt><dd>{money(reference.records.reduce((n,r)=>n+Number(r.expected_gross ?? 0),0)-reference.bank.reduce((n,b)=>n+Math.abs(b.value),0))}</dd></dl>{reference.bank.map(b=><p key={b.mf_transaction_id}>{b.date} / {b.content} / {money(Math.abs(b.value))}</p>)}{reference.records.map(r=><p key={r.kintone_record_id}>{kintoneBase && <a href={kintoneLink(kintoneBase,r.kintone_record_id)} target="_blank" rel="noopener noreferrer">Kintoneレコード</a>}{driveLink(r.drive_link) && <a href={driveLink(r.drive_link)!} target="_blank" rel="noopener noreferrer">Googleドライブ明細</a>}</p>)}</Modal>}
    {selected && <Details title={detailTitle} daysAfter={daysAfter} showDifferences={showDifferences} rows={selected} kintoneBase={kintoneBase} onClose={()=>setSelected(null)} />}</section></>}</div>;
}
