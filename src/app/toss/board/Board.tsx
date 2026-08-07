"use client";

import { useEffect, useMemo, useState } from "react";
import type { TossBoardRow, TossStatus } from "../_lib/board";
import styles from "./page.module.css";

type SortKey = "introducedAt" | "partnerName" | "rank" | "status" | "latestActivity";
const columns: { key: keyof TossBoardRow; label: string }[] = [
  {key:"introducedAt",label:"紹介日"},{key:"partnerName",label:"トス者名"},{key:"products",label:"トスアップ商材"},{key:"rank",label:"トスランク"},
  {key:"currentContractName",label:"現契約名義"},{key:"applicantName",label:"申込者名"},{key:"area",label:"エリア"},{key:"status",label:"状況"},
  {key:"latestActivity",label:"最終更新"},{key:"orderedProducts",label:"受注商材"},{key:"cancellationReason",label:"キャンセル理由"},
];
const statusOrder: Record<TossStatus, number> = {連携受付:0,対応中:1,受注:2,キャンセル:3};

export default function Board() {
  const [rows,setRows]=useState<TossBoardRow[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState(""); const [limited,setLimited]=useState(false);
  const [mine,setMine]=useState(false); const [search,setSearch]=useState(""); const [status,setStatus]=useState(""); const [rank,setRank]=useState(""); const [product,setProduct]=useState("");
  const [sort,setSort]=useState<SortKey>("introducedAt"); const [direction,setDirection]=useState<"asc"|"desc">("desc");
  useEffect(()=>{let active=true;fetch(`/api/toss/board${mine?"?mine=1":""}`).then(async r=>{const b=await r.json();if(!r.ok)throw new Error(b.error);if(active){setRows(b.rows);setLimited(b.limited);}}).catch(e=>{if(active)setError(e instanceof Error?e.message:"一覧を取得できません");}).finally(()=>{if(active)setLoading(false);});return()=>{active=false};},[mine]);
  const products=useMemo(()=>Array.from(new Set(rows.flatMap(row=>row.products))).sort(),[rows]);
  const visible=useMemo(()=>rows.filter(row=>{
    const haystack=[row.partnerName,row.currentContractName,row.applicantName,row.area,row.latestCall,row.cancellationReason,...row.products,...row.orderedProducts].join(" ").toLowerCase();
    return (!search||haystack.includes(search.toLowerCase()))&&(!status||row.status===status)&&(!rank||row.rank===rank)&&(!product||row.products.includes(product));
  }).sort((a,b)=>{const av=sort==="status"?statusOrder[a.status]:String(a[sort]||"");const bv=sort==="status"?statusOrder[b.status]:String(b[sort]||"");const result=av<bv?-1:av>bv?1:0;return direction==="asc"?result:-result;}),[rows,search,status,rank,product,sort,direction]);
  function changeSort(key:SortKey){if(sort===key)setDirection(value=>value==="asc"?"desc":"asc");else{setSort(key);setDirection("asc");}}
  return <section className={styles.board}>
    <div className={styles.toolbar}><label className={styles.search}>検索<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="名前・エリア・商材など"/></label><Filter label="状況" value={status} values={["連携受付","対応中","受注","キャンセル"]} change={setStatus}/><Filter label="ランク" value={rank} values={["S","A","B","C","D"]} change={setRank}/><Filter label="商材" value={product} values={products} change={setProduct}/><label className={styles.mine}><input type="checkbox" checked={mine} onChange={e=>{setLoading(true);setError("");setMine(e.target.checked)}}/>自分の分だけ</label></div>
    <div className={styles.summary}><span>{loading?"読込中…":`${visible.length} 件`}</span>{limited&&<small>直近500件を表示</small>}{error&&<strong>{error}</strong>}</div>
    <div className={styles.sheet}><table><thead><tr>{columns.map((column,index)=><th key={column.key} className={index===0?styles.first:""}>{(["introducedAt","partnerName","rank","status","latestActivity"] as string[]).includes(column.key)?<button onClick={()=>changeSort(column.key as SortKey)}>{column.label}{sort===column.key?(direction==="asc"?" ↑":" ↓"):""}</button>:column.label}</th>)}</tr></thead><tbody>{!loading&&!error&&visible.map(row=><tr key={row.id}>{columns.map((column,index)=><td key={column.key} className={index===0?styles.first:""}>{column.key==="status"?<span className={`${styles.badge} ${styles[row.status]}`}>{row.status}</span>:format(row[column.key])}{column.key==="latestActivity"&&row.latestCall&&<small className={styles.call}>{row.latestCall}</small>}</td>)}</tr>)}{!loading&&!error&&!visible.length&&<tr><td colSpan={columns.length} className={styles.empty}>該当する案件はありません</td></tr>}</tbody></table></div>
  </section>;
}
function Filter({label,value,values,change}:{label:string;value:string;values:string[];change:(v:string)=>void}){return <label>{label}<select value={value} onChange={e=>change(e.target.value)}><option value="">すべて</option>{values.map(v=><option key={v}>{v}</option>)}</select></label>}
function format(value:TossBoardRow[keyof TossBoardRow]){return Array.isArray(value)?value.join("・")||"—":value||"—"}
