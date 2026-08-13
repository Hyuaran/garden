"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PUNCH_LABELS, SYNC_LABELS, type PunchType } from "../../_lib/attendance";
import styles from "../attendance.module.css";

type Row = { id:number; punch_type:PunchType; punched_at:string; kot_sync_status:string; root_employees:{name?:string;kot_employee_id?:string|null}|null };
export default function SyncStatusClient(){
  const [data,setData]=useState<{counts:Record<string,number>;punches:Row[];limit:number}|null>(null); const [error,setError]=useState<string|null>(null);
  useEffect(()=>{void (async()=>{try{const response=await fetch("/api/system/attendance/sync-status",{cache:"no-store"});const result=await response.json();if(!response.ok)throw new Error(result.error);setData(result);}catch(cause){setError(cause instanceof Error?cause.message:"同期状況を取得できませんでした");}})();},[]);
  return <div className={styles.shell}><main className={styles.main}><header className={styles.header}><div><p className={styles.eyebrow}>KING OF TIME</p><h1>同期状況</h1></div><Link className={styles.adminLink} href="/system/attendance">打刻へ戻る</Link></header>
    <p>第1段ではKOT送信を行わないため、新しい打刻は「未送信」で蓄積されます。</p>{error&&<p role="alert" className={styles.error}>{error}</p>}{!data&&!error?<p>読み込み中…</p>:data&&<><section className={styles.history}><h2>対象件数</h2><p>{Object.entries(data.counts).map(([key,value])=>`${SYNC_LABELS[key]??key}: ${value}件`).join(" ／ ")||"対象なし"}</p></section><section className={styles.history}><h2>未同期一覧（最大{data.limit}件）</h2>{data.punches.length===0?<p>対象の打刻はありません。</p>:<ul>{data.punches.map(row=><li key={row.id}><strong>{new Date(row.punched_at).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}</strong><span>{row.root_employees?.name??"従業員不明"}／{PUNCH_LABELS[row.punch_type]}</span><small>{SYNC_LABELS[row.kot_sync_status]??row.kot_sync_status}</small></li>)}</ul>}</section></>}</main></div>;
}
