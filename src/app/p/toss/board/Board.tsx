"use client";

import { useEffect, useMemo, useState } from "react";
import type { TossBoardRow, TossStatus } from "../_lib/board";
import styles from "./page.module.css";

type ColumnKey = Exclude<keyof TossBoardRow, "id" | "partnerCode" | "latestCall">;
const columns: { key: ColumnKey; label: string }[] = [
  {key:"introducedAt",label:"紹介日"},{key:"partnerName",label:"トス者名"},{key:"products",label:"トスアップ商材"},{key:"rank",label:"トスランク"},
  {key:"currentContractName",label:"現契約名義"},{key:"applicantName",label:"申込者名"},{key:"area",label:"エリア"},{key:"status",label:"状況"},
  {key:"latestActivity",label:"最終更新"},{key:"orderedProducts",label:"受注商材"},{key:"cancellationReason",label:"キャンセル理由"},
];
const statusOrder: Record<TossStatus, number> = {連携受付:0,対応中:1,受注:2,キャンセル:3};
const display = (value: TossBoardRow[ColumnKey]) => Array.isArray(value) ? value.join("・") || "—" : value || "—";

export default function Board() {
  const [rows,setRows]=useState<TossBoardRow[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState(""); const [limited,setLimited]=useState(false);
  const [mine,setMine]=useState<boolean|null>(null); const [search,setSearch]=useState(""); const [status,setStatus]=useState(""); const [rank,setRank]=useState(""); const [product,setProduct]=useState("");
  const [columnFilters,setColumnFilters]=useState<Partial<Record<ColumnKey,string>>>({}); const [sort,setSort]=useState<ColumnKey>("introducedAt"); const [direction,setDirection]=useState<"asc"|"desc">("desc");

  useEffect(()=>{let active=true;const query=mine===null?"":`?mine=${mine?1:0}`;fetch(`/api/toss/board${query}`).then(async r=>{const body=await r.json();if(!r.ok)throw new Error(body.error);if(active){setRows(body.rows);setLimited(body.limited);setMine(body.mine);}}).catch(e=>{if(active)setError(e instanceof Error?e.message:"一覧を取得できません");}).finally(()=>{if(active)setLoading(false);});return()=>{active=false};},[mine]);
  const products=useMemo(()=>Array.from(new Set(rows.flatMap(row=>row.products))).sort(),[rows]);
  const columnValues=useMemo(()=>Object.fromEntries(columns.map(column=>[column.key,Array.from(new Set(rows.map(row=>display(row[column.key])))).filter(value=>value!=="—").sort()])),[rows]);
  const visible=useMemo(()=>rows.filter(row=>{
    const haystack=[row.partnerName,row.currentContractName,row.applicantName,row.area,row.latestCall,row.cancellationReason,...row.products,...row.orderedProducts].join(" ").toLowerCase();
    return (!search||haystack.includes(search.toLowerCase()))&&(!status||row.status===status)&&(!rank||row.rank===rank)&&(!product||row.products.includes(product))&&columns.every(column=>!columnFilters[column.key]||display(row[column.key])===columnFilters[column.key]);
  }).sort((a,b)=>{const av=sort==="status"?statusOrder[a.status]:display(a[sort]);const bv=sort==="status"?statusOrder[b.status]:display(b[sort]);const result=av<bv?-1:av>bv?1:0;return direction==="asc"?result:-result;}),[rows,search,status,rank,product,columnFilters,sort,direction]);
  function changeSort(key:ColumnKey){if(sort===key)setDirection(value=>value==="asc"?"desc":"asc");else{setSort(key);setDirection("asc");}}
  function toggleMine(checked:boolean){setLoading(true);setError("");setMine(checked);}

  return <section className={styles.board}>
    <div className={styles.toolbar}><label className={styles.search}>検索<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="名前・エリア・商材など"/></label><Filter label="状況" value={status} values={["連携受付","対応中","受注","キャンセル"]} change={setStatus}/><Filter label="ランク" value={rank} values={["S","A","B","C","D"]} change={setRank}/><Filter label="商材" value={product} values={products} change={setProduct}/><label className={styles.mine}><input type="checkbox" checked={mine===true} disabled={mine===null} onChange={e=>toggleMine(e.target.checked)}/>自分の分だけ</label></div>
    <div className={styles.summary}><span>{loading?"読込中…":`${visible.length} 件`}</span>{limited&&<small>直近500件を表示</small>}{error&&<strong>{error}</strong>}</div>
    <div className={styles.sheet}><table><thead><tr>{columns.map((column,index)=><th key={column.key} className={index===0?styles.first:""} onClick={()=>changeSort(column.key)}><div className={styles.columnTitle}>{column.label}<span>{sort===column.key?(direction==="asc"?"↑":"↓"):"↕"}</span></div><select aria-label={`${column.label}で絞り込み`} value={columnFilters[column.key]||""} onClick={e=>e.stopPropagation()} onChange={e=>setColumnFilters(current=>({...current,[column.key]:e.target.value}))}><option value="">すべて</option>{(columnValues[column.key]||[]).map(value=><option key={value}>{value}</option>)}</select></th>)}</tr></thead><tbody>{!loading&&!error&&visible.map(row=><tr key={row.id}>{columns.map((column,index)=><td key={column.key} className={index===0?styles.first:""}>{column.key==="status"?<span className={`${styles.badge} ${styles[row.status]}`}>{row.status}</span>:display(row[column.key])}{column.key==="latestActivity"&&row.latestCall&&<small className={styles.call}>{row.latestCall}</small>}</td>)}</tr>)}{!loading&&!error&&!visible.length&&<tr><td colSpan={columns.length} className={styles.empty}>該当する案件はありません</td></tr>}</tbody></table></div>
  </section>;
}
function Filter({label,value,values,change}:{label:string;value:string;values:string[];change:(v:string)=>void}){return <label>{label}<select value={value} onChange={e=>change(e.target.value)}><option value="">すべて</option>{values.map(v=><option key={v}>{v}</option>)}</select></label>}
