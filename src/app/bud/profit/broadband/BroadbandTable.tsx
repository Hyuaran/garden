"use client";
import { rootZoom } from "@/app/_lib/font-size";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import SystemTabs, { TabActionButton } from "@/app/system/_components/SystemTabs/SystemTabs";
import UpdatedStamp, { UpdatedStampRow } from "@/app/system/_components/UpdatedStamp/UpdatedStamp";
import BoxSelect from "@/app/system/_components/BoxSelect/BoxSelect";
import { buildPivot, defaultPeriod, cellTone, kintoneLink, money, periodMonths, periodOptions, applyOrder, movePivot, orderFromPivot, readOrder, recordStatus, saveOrder, sortOptions, statusLabels, total, type BroadbandOrder, type PivotRow, type SortMode, type TableRecord } from "@/lib/bud/broadband/table";
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
  const [periods,setPeriods]=useState([defaultPeriod(today)]), [order,setOrder]=useState<BroadbandOrder|null>(null), [sorting,setSorting]=useState(false), [selected,setSelected]=useState<TableRecord[]|null>(null), [busy,setBusy]=useState(false), [message,setMessage]=useState("");
  // 縦はページのスクロールだけ（表の中に縦スクロールを作らない・東海林さん 2026-10-21）。
  // 横スクロールのバーは画面の下に張り付けて、表の下まで行かなくても動かせるようにする
  const scrollRef=useRef<HTMLDivElement>(null), barRef=useRef<HTMLDivElement>(null), [barWidth,setBarWidth]=useState(0);
  const [bar,setBar]=useState<{left:number;width:number}|null>(null);
  // 見出しの行（月）は、表の先頭が画面の上に来たら上に固定して出す（東海林さん 2026-10-21）
  const headRef=useRef<HTMLDivElement>(null), [head,setHead]=useState<{left:number;width:number;top:number;widths:number[];tableWidth:number}|null>(null);
  useEffect(() => {
    const el=scrollRef.current; if(!el) return;
    // 表が画面の下にはみ出しているあいだだけ、画面の一番下に表と同じ幅で出す（外枠の作りで sticky が効かないため fixed）
    const fit=()=>{ const zoom=rootZoom(); setBarWidth(el.scrollWidth); const r=el.getBoundingClientRect(); setBar(el.scrollWidth>el.clientWidth && r.top<window.innerHeight && r.bottom>window.innerHeight ? {left:r.left/zoom,width:r.width/zoom} : null);
      const thead=el.querySelector("thead"), top=Math.max(0,el.closest("main")?.getBoundingClientRect().top ?? 0);
      const h=thead?.getBoundingClientRect();
      setHead(thead && h && h.top<top && r.bottom>top+h.height*2 ? {left:r.left/zoom,width:r.width/zoom,top:top/zoom,tableWidth:el.scrollWidth,widths:[...thead.querySelectorAll("th")].map(th=>th.getBoundingClientRect().width/zoom)} : null); };
    fit(); const observer=new ResizeObserver(fit); observer.observe(el); if(el.firstElementChild) observer.observe(el.firstElementChild);
    window.addEventListener("scroll",fit,true); window.addEventListener("resize",fit); window.addEventListener("garden-font-size-change",fit);
    return ()=>{ observer.disconnect(); window.removeEventListener("scroll",fit,true); window.removeEventListener("resize",fit); window.removeEventListener("garden-font-size-change",fit); };
  },[]);
  useEffect(() => { if(bar) sync(scrollRef.current,barRef.current); },[bar]);
  useEffect(() => { if(head) sync(scrollRef.current,headRef.current); },[head]);
  const sync=(from:HTMLDivElement|null,to:HTMLDivElement|null)=>{ if(from&&to&&to.scrollLeft!==from.scrollLeft) to.scrollLeft=from.scrollLeft; };
  useEffect(()=>{try {setOrder(readOrder(window.localStorage,userId));}catch {setOrder(null);}},[userId]);
  const months=periodMonths(periods,today,rows), allMonths=[...new Set(rows.flatMap(r=>r.scheduled_date ? [r.scheduled_date.slice(0,7)] : []))];
  const fullPivot=applyOrder(buildPivot(rows,allMonths,"cash"),order), pivot=applyOrder(buildPivot(rows,months,"cash"),orderFromPivot(fullPivot));
  const persist=(next:BroadbandOrder)=>{setOrder(next);try {saveOrder(window.localStorage,userId,next);}catch {}};
  const [dragging,setDragging]=useState<string|null>(null),[target,setTarget]=useState<string|null>(null);
  const gesture=useRef<{pointer:number;active:boolean;x:number;y:number;timer:ReturnType<typeof setTimeout>|null}|null>(null);
  const stop=()=>{if(gesture.current?.timer) clearTimeout(gesture.current.timer);gesture.current=null;setDragging(null);setTarget(null);};
  useEffect(()=>()=>{if(gesture.current?.timer) clearTimeout(gesture.current.timer);},[]);
  const compatible=(a:PivotRow,b:PivotRow)=>b.key!=="grand" && a.subtotal===b.subtotal && (a.subtotal || a.business===b.business);
  const handle=(row:PivotRow)=><button className={styles.grip} aria-label={(row.subtotal ? row.business : row.partner)+"をつかんで移動"} onKeyDown={e=>{
    if(e.key!=="ArrowUp" && e.key!=="ArrowDown") return;e.preventDefault();const siblings=pivot.filter(r=>compatible(row,r)),i=siblings.findIndex(r=>r.key===row.key),next=siblings[i+(e.key==="ArrowUp" ? -1 : 1)];if(next) persist(movePivot(fullPivot,row.key,next.key));
  }} onPointerDown={e=>{
    if(e.button!==0) return;stop();e.currentTarget.setPointerCapture?.(e.pointerId);const g={pointer:e.pointerId,active:e.pointerType==="mouse",x:e.clientX,y:e.clientY,timer:null as ReturnType<typeof setTimeout>|null};gesture.current=g;
    if(g.active) setDragging(row.key);else g.timer=setTimeout(()=>{g.active=true;setDragging(row.key);},400);
  }} onPointerMove={e=>{
    const g=gesture.current;if(!g || g.pointer!==e.pointerId) return;if(!g.active){if(Math.hypot(e.clientX-g.x,e.clientY-g.y)>8) stop();return;}
    e.preventDefault();const key=document.elementFromPoint(e.clientX,e.clientY)?.closest("tr[data-row-key]")?.getAttribute("data-row-key"),next=pivot.find(r=>r.key===key);setTarget(next && next.key!==row.key && compatible(row,next) ? next.key : null);
    if(e.clientY<80) window.scrollBy(0,-12);else if(e.clientY>window.innerHeight-80) window.scrollBy(0,12);
  }} onPointerUp={()=>{if(gesture.current?.active && target) persist(movePivot(fullPivot,row.key,target));stop();}} onPointerCancel={stop} onLostPointerCapture={stop}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg></button>;
  // 行の無い欄は空にする（0 円を並べない）。小計・総合計の行は色を付けない（色は取引先の行だけ）
  const cell=(records:TableRecord[], label:string, toned=true) => records.length ? <button aria-label={`${label} ${money(total(records))}の明細`} className={toned ? styles[cellTone(records)] : undefined} disabled={sorting} onClick={() => {if(!sorting) setSelected(records);}}>{money(total(records))}</button> : null;
  return <div className={styles.pageShell}><SystemBreadcrumb root={{label:"Bud",href:"/bud/dashboard"}} items={[{label:"損益管理",href:"/bud/profit"},{label:"ブロードバンド事業の収支"}]} /><h1>ブロードバンド事業の収支</h1>
    <UpdatedStampRow><UpdatedStamp label="Kintone" date={rows.map(r=>r.updated_at).sort().at(-1)} busy={busy} refreshLabel="収支を更新" onRefresh={async()=>{setBusy(true);setMessage("確認中です");try {const response=await fetch("/api/bud/broadband/refresh",{method:"POST"});const result=await response.json();if(!response.ok) throw new Error(result.error);setMessage(result.message ?? "");router.refresh();}catch {setMessage("収支を更新できませんでした。時間をおいてもう一度お試しください。");}finally {setBusy(false);}}} /></UpdatedStampRow>
    <div className={styles.tabRow}><SystemTabs actions={<TabActionButton icon="sort" label="並べ替え" pressed={sorting} onClick={()=>{stop();setSorting(!sorting);setSelected(null);}} />}><button role="tab" aria-selected="true" id="broadband-tab" aria-controls="broadband-panel">収支の表</button></SystemTabs></div>
    {sorting && <div className={styles.orderToolbar} aria-label="並び替えモード">{sortOptions.map(o=><button key={o.value} onClick={()=>persist(orderFromPivot(buildPivot(rows,allMonths,o.value as SortMode)))}>{o.value==="cash" ? "入金 → 支払いの順に戻す" : o.label+"にする"}</button>)}<button onClick={()=>{stop();setSorting(false);}}>終える</button></div>}
    <section role="tabpanel" id="broadband-panel" aria-labelledby="broadband-tab"><div className={styles.periodLegend}><BoxSelect label="期間" value={periods} options={periodOptions(rows,today)} onChange={value=>{setPeriods(value);setSelected(null);}} />
    <div className={styles.legend} aria-label="色の凡例"><div>金額はすべて税抜</div><div><span className={styles.swatch+" "+styles.red} />口座と合わない・まだ届いていない</div><div><span className={styles.swatch+" "+styles.gray} />予定日前</div><div><span className={styles.swatch} />口座で確認済み</div><div>色なし＝照合の対象外</div></div></div>{message && <p role="status">{message}</p>}
    <div ref={scrollRef} className={styles.scroll} onScroll={()=>{sync(scrollRef.current,barRef.current);sync(scrollRef.current,headRef.current);}}><table><thead><tr><th>事業内容</th><th>取引先</th>{months.map(m=><th key={m}>{Number(m.slice(0,4))}年{Number(m.slice(5,7))}月</th>)}<th>合計（税抜）</th></tr></thead><tbody>{pivot.map(row=><tr key={row.key} data-row-key={row.key} className={[row.subtotal ? styles.subtotal : "",dragging===row.key ? styles.dragging : "",target===row.key ? styles.dropTarget : ""].join(" ")}><th scope="row">{sorting && row.key!=="grand" && handle(row)}{row.subtotal ? row.business : ""}</th><td>{row.partner}</td>{months.map(month=><td key={month}>{cell(row.records.filter(r=>r.scheduled_date?.startsWith(month)),`${row.business} ${row.partner} ${month}`,!row.subtotal)}</td>)}<td>{cell(row.records,`${row.business} ${row.partner} 合計`,!row.subtotal)}</td></tr>)}</tbody></table></div>{head && <div ref={headRef} className={`${styles.scroll} ${styles.stickyHead}`} style={{left:head.left,width:head.width,top:head.top}} aria-hidden="true"><table style={{width:head.tableWidth,minWidth:head.tableWidth}}><thead><tr>{["事業内容","取引先",...months.map(m=>`${Number(m.slice(0,4))}年${Number(m.slice(5,7))}月`),"合計（税抜）"].map((label,i)=><th key={label} style={{width:head.widths[i],minWidth:head.widths[i],maxWidth:head.widths[i],boxSizing:"border-box"}}>{label}</th>)}</tr></thead></table></div>}{bar && <div ref={barRef} className={styles.stickyBar} style={{left:bar.left,width:bar.width}} aria-hidden="true" onScroll={()=>sync(barRef.current,scrollRef.current)}><div style={{width:barWidth,height:1}} /></div>}
    {selected && <Details rows={selected} kintoneBase={kintoneBase} onClose={()=>setSelected(null)} />}</section></div>;
}
