"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PUNCH_LABELS, SYNC_LABELS, type PunchType } from "../../_lib/attendance";
import styles from "../attendance.module.css";
import exportStyles from "./sync-status.module.css";

type Row = { id:number; punch_type:PunchType; punched_at:string; kot_sync_status:string; root_employees:{name?:string;kot_employee_id?:string|null}|null };
type StatusData = { counts:Record<string,number>; exportSummary:{eligible:number;missingCode:number;missingCodeNames:string[];outOfRange:number}; punches:Row[]; limit:number };

export default function SyncStatusClient() {
  const [data, setData] = useState<StatusData|null>(null); const [error, setError] = useState<string|null>(null);
  const [notice, setNotice] = useState<string|null>(null); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const response = await fetch("/api/system/attendance/sync-status", { cache:"no-store" }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setData(result); }, []);
  useEffect(() => { void load().catch((cause) => setError(cause instanceof Error ? cause.message : "同期状況を取得できませんでした")); }, [load]);
  async function generate() { setBusy(true); setError(null); setNotice(null); try { const response = await fetch("/api/system/attendance/kot-export", { method:"POST" }); if (!response.ok) { const result = await response.json(); throw new Error(result.error); } const blob = await response.blob(); const disposition = response.headers.get("content-disposition") ?? ""; const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "kot_punches.csv"; const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href=url; anchor.download=filename; anchor.click(); URL.revokeObjectURL(url); setNotice(`${response.headers.get("x-kot-export-count") ?? ""}件のCSVを生成しました。KOT取込結果を確認してください。`); await load(); } catch(cause) { setError(cause instanceof Error ? cause.message : "CSVを生成できませんでした"); } finally { setBusy(false); } }
  async function transition(action:"confirm"|"revert") { setBusy(true); setError(null); setNotice(null); try { const response = await fetch(`/api/system/attendance/kot-export/${action}`, { method:"POST" }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setNotice(action === "confirm" ? `${result.updated}件を送信済みに確定しました。` : `${result.updated}件を未送信へ戻しました。`); await load(); } catch(cause) { setError(cause instanceof Error ? cause.message : "状態を更新できませんでした"); } finally { setBusy(false); } }
  const sending = data?.counts.sending ?? 0;
  return <div className={`${styles.shell} ${styles.shellEmbedded}`}><div className={`${styles.main} ${styles.mainEmbedded}`}><header className={styles.header}><div><p className={styles.eyebrow}>SYSTEM / ATTENDANCE</p><h1>同期状況</h1></div><Link className={styles.adminLink} href="/system/attendance">打刻へ戻る</Link></header>
    {error&&<p role="alert" className={styles.error}>{error}</p>}{notice&&<p role="status" className={exportStyles.noticeText}>{notice}</p>}{!data&&!error?<p>読み込み中…</p>:data&&<>
    <section className={styles.history}><h2>対象件数</h2><p>{Object.entries(data.counts).map(([key,value])=>`${SYNC_LABELS[key]??key}: ${value}件`).join(" ／ ")}</p></section>
    <section className={styles.history}><h2>KOT取込CSV</h2><p>生成可能: {data.exportSummary.eligible}件（1回最大1000件）</p><p>従業員コード未設定で除外: {data.exportSummary.missingCode}件{data.exportSummary.missingCodeNames.length?`（${data.exportSummary.missingCodeNames.join("、")}）`:""}</p><p>登録範囲外で除外: {data.exportSummary.outOfRange}件</p>
      {sending>0&&<p className={exportStyles.warning}>生成済み未確定が{sending}件あります。先に「アップロード完了」または「取消」で解消してください。</p>}<div className={exportStyles.exportActions}><button type="button" disabled={busy||sending>0||data.exportSummary.eligible===0} onClick={()=>void generate()}>KOT取込CSVを生成</button>{sending>0&&<><button type="button" disabled={busy} onClick={()=>void transition("confirm")}>アップロード完了にする</button><button type="button" className={exportStyles.secondaryButton} disabled={busy} onClick={()=>void transition("revert")}>取消（未送信に戻す）</button></>}</div><p className={exportStyles.help}>KOT取込でエラー一覧が出た場合は確定せず、「取消」→原因を修正→CSVを再生成してください。</p></section>
    <section className={styles.history}><h2>未同期一覧（最大{data.limit}件）</h2>{data.punches.length===0?<p>対象の打刻はありません。</p>:<ul>{data.punches.map(row=><li key={row.id}><strong>{new Date(row.punched_at).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}</strong><span>{row.root_employees?.name??"従業員不明"}／{PUNCH_LABELS[row.punch_type]}</span><small>{SYNC_LABELS[row.kot_sync_status]??row.kot_sync_status}</small></li>)}</ul>}</section></>}</div></div>;
}
